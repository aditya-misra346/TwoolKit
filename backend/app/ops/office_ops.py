"""Office conversions via LibreOffice, plus slide/page rendering to images and video."""

from __future__ import annotations

import zipfile
from pathlib import Path
from typing import Any

from .. import libreoffice
from ..capabilities import probe_video_codec
from ..jobs import InputFile, JobContext, UserError
from ..validation import output_name
from .pdf_ops import open_pdf, safe_dpi

FAMILY_TARGETS: dict[str, list[str]] = {
    "text": ["pdf", "docx", "odt", "rtf", "txt", "html", "doc"],
    "sheet": ["pdf", "xlsx", "ods", "csv", "html", "xls"],
    "slides": ["pdf", "pptx", "odp", "ppt"],
}

OFFICE_INPUTS = {"doc", "docx", "odt", "rtf", "txt", "html", "xls", "xlsx", "ods", "csv", "tsv", "ppt", "pptx", "odp"}


def targets_for(src_type: str) -> list[str]:
    fam = libreoffice.FAMILY_OF.get(src_type)
    if not fam:
        return []
    return [t for t in FAMILY_TARGETS[fam] if t != src_type]


def validate_output(path: Path, target: str) -> None:
    """Open the produced file with the matching library; raise UserError if broken."""
    try:
        if path.stat().st_size == 0:
            raise ValueError("empty file")
        if target == "pdf":
            import pymupdf

            with pymupdf.open(path) as d:
                if d.page_count == 0:
                    raise ValueError("no pages")
        elif target == "docx":
            import docx

            docx.Document(str(path))
        elif target == "xlsx":
            from openpyxl import load_workbook

            load_workbook(path, read_only=True).close()
        elif target == "pptx":
            from pptx import Presentation

            Presentation(str(path))
        elif target in ("odt", "ods", "odp"):
            with zipfile.ZipFile(path) as zf:
                if zf.testzip() is not None or "content.xml" not in zf.namelist():
                    raise ValueError("invalid OpenDocument package")
        elif target in ("doc", "xls", "ppt"):
            with path.open("rb") as fh:
                if fh.read(8) != b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
                    raise ValueError("not an OLE2 file")
        elif target == "rtf":
            with path.open("rb") as fh:
                if not fh.read(5).startswith(b"{\\rtf"):
                    raise ValueError("not RTF")
    except UserError:
        raise
    except Exception as exc:
        raise UserError(f"The converted {target.upper()} file failed validation ({exc}).") from exc


def convert(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    target = str(opts.get("target", "")).lower()
    src = inp.detected_type
    allowed = targets_for(src)
    if not allowed:
        raise UserError(f"{src.upper()} files can't be converted by the document converter.")
    if target not in allowed:
        raise UserError(f"Can't convert {src.upper()} to {target.upper() or '?'}. Supported: {', '.join(t.upper() for t in allowed)}.")
    out_dir = ctx.new_work_dir("lo_out")
    produced = libreoffice.convert(ctx, inp.path, src, target, out_dir)
    ctx.progress(0.95, "Validating output")
    for p in produced:
        validate_output(p, target)
    if len(produced) == 1:
        ctx.add_output(produced[0], output_name(inp.name, target))
    else:  # e.g. multi-sheet CSV export
        z = out_dir / "bundle.zip"
        stem = Path(inp.name).stem
        with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
            for p in produced:
                suffix = p.stem.removeprefix("input")
                zf.write(p, f"{stem}{suffix}{p.suffix}")
        ctx.add_output(z, output_name(inp.name, "zip", f"-{target}"), note=f"{len(produced)} files (one per sheet)")
    if src in ("pptx", "ppt", "odp") and target == "pdf":
        ctx.warn("Animations, transitions and embedded media can't be represented in PDF.")
    if src in ("xlsx", "xls", "ods") and target == "csv":
        ctx.warn("CSV stores values only — formulas, formatting and charts are not kept.")
    if target == "txt":
        ctx.warn("Plain text keeps only the words; all formatting, images and tables are dropped.")


def _to_pdf(ctx: JobContext, inp: InputFile) -> Path:
    if inp.detected_type == "pdf":
        return inp.path
    if inp.detected_type not in OFFICE_INPUTS:
        raise UserError(f"{inp.detected_type.upper()} can't be rendered. Use a presentation, document or PDF.")
    produced = libreoffice.convert(ctx, inp.path, inp.detected_type, "pdf", ctx.new_work_dir("lo_pdf"))
    validate_output(produced[0], "pdf")
    return produced[0]


def _render_pages(ctx: JobContext, pdf_path: Path, dpi: int, start: float, span: float):
    """Yield (index, count, PIL.Image) for every page."""
    from PIL import Image

    doc = open_pdf(pdf_path)
    try:
        n = doc.page_count
        for i in range(n):
            ctx.check()
            ctx.progress(start + span * i / n, f"Rendering slide {i + 1} of {n}")
            page = doc[i]
            pix = page.get_pixmap(dpi=safe_dpi(page, dpi), alpha=False)
            yield i, n, Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    finally:
        doc.close()


def to_images(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    fmt = str(opts.get("format", "png")).lower()
    if fmt == "jpg":
        fmt = "jpeg"
    if fmt not in ("jpeg", "png", "webp"):
        raise UserError("format must be jpeg, png or webp.")
    dpi = int(opts.get("dpi", 150))
    quality = max(10, min(100, int(opts.get("quality", 90))))
    pdf = _to_pdf(ctx, inp)
    work = ctx.new_work_dir("slides")
    stem = Path(inp.name).stem
    files: list[Path] = []
    ext = "jpg" if fmt == "jpeg" else fmt
    for i, n, img in _render_pages(ctx, pdf, dpi, 0.3 if pdf is not inp.path else 0.0, 0.65):
        p = work / f"{stem}-{i + 1:0{len(str(n))}d}.{ext}"
        kw: dict[str, Any] = {"optimize": True} if fmt != "webp" else {"method": 4}
        if fmt in ("jpeg", "webp"):
            kw["quality"] = quality
        img.save(p, fmt.upper(), **kw)
        files.append(p)
    if len(files) == 1:
        ctx.add_output(files[0], files[0].name)
        return
    z = work / "slides.zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:  # images are already compressed
        for p in files:
            zf.write(p, p.name)
    ctx.add_output(z, output_name(inp.name, "zip", f"-{ext}"), note=f"{len(files)} images")


def to_video(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    import cv2
    import numpy as np

    codec = probe_video_codec()
    if not codec.get("available"):
        raise UserError("No working video encoder is available on the server.")
    secs = max(1.0, min(30.0, float(opts.get("secondsPerSlide", 3))))
    width = int(opts.get("width", 1920))
    width = max(320, min(3840, width)) // 2 * 2
    fps = 5
    pdf = _to_pdf(ctx, inp)
    work = ctx.new_work_dir("video")
    out = work / f"out.{codec['container']}"
    writer = None
    size: tuple[int, int] | None = None
    try:
        for i, n, img in _render_pages(ctx, pdf, 200, 0.3 if pdf is not inp.path else 0.0, 0.65):
            if size is None:
                h = int(round(img.height * width / img.width)) // 2 * 2
                size = (width, h)
                writer = cv2.VideoWriter(str(out), cv2.VideoWriter_fourcc(*codec["fourcc"]), fps, size)
                if not writer.isOpened():
                    raise UserError("The video encoder failed to start.")
            # letterbox each slide into the first slide's frame size
            img.thumbnail(size)
            canvas = np.zeros((size[1], size[0], 3), dtype=np.uint8)
            arr = cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2BGR)
            y = (size[1] - arr.shape[0]) // 2
            x = (size[0] - arr.shape[1]) // 2
            canvas[y : y + arr.shape[0], x : x + arr.shape[1]] = arr
            for _ in range(int(secs * fps)):
                writer.write(canvas)
    finally:
        if writer is not None:
            writer.release()
    cap = cv2.VideoCapture(str(out))
    ok, _ = cap.read()
    cap.release()
    if not ok:
        raise UserError("The generated video could not be read back.")
    ctx.warn("Slides are shown as still frames; animations, transitions and audio are not rendered.")
    if codec["codec"] == "mp4v":
        ctx.warn("Encoded as MPEG-4 Part 2 (mp4v); some browsers may not play it inline — use VLC or QuickTime.")
    ctx.add_output(out, output_name(inp.name, codec["container"]), note=f"{codec['codec']} · {secs:g}s per slide")
