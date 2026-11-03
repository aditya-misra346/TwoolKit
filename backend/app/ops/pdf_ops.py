"""PDF operations backed by PyMuPDF, pdf2docx, pikepdf, python-pptx and openpyxl."""

from __future__ import annotations

import html
import re
import shutil
import zipfile
from pathlib import Path
from typing import Any

import pymupdf as fitz

from ..config import MAX_RENDER_DPI, MAX_RENDER_PIXELS
from ..jobs import InputFile, JobContext, UserError
from ..validation import output_name

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def open_pdf(path: Path, password: str | None = None) -> fitz.Document:
    """Open a PDF, authenticating if encrypted. Raises actionable UserErrors."""
    try:
        doc = fitz.open(path, filetype="pdf")
    except Exception as exc:
        raise UserError(
            f"This PDF could not be opened ({exc}). It may be corrupted — try the Repair PDF tool."
        ) from exc
    if doc.needs_pass:
        if not password:
            doc.close()
            raise UserError(
                "This PDF is password-protected. Enter its password in the options (or unlock it first)."
            )
        if not doc.authenticate(password):
            doc.close()
            raise UserError("Incorrect password for this PDF.")
    if doc.page_count == 0:
        doc.close()
        raise UserError("This PDF has no pages.")
    return doc


def parse_page_ranges(spec: str | None, count: int) -> list[int]:
    """'1-3,5' → [0,1,2,4]; empty → all pages. Validates bounds."""
    if not spec or not str(spec).strip():
        return list(range(count))
    pages: list[int] = []
    for part in str(spec).replace(" ", "").split(","):
        if not part:
            continue
        m = re.fullmatch(r"(\d+)(?:-(\d+))?", part)
        if not m:
            raise UserError(f"Invalid page range '{part}'. Use a format like 1-3,5.")
        a = int(m.group(1))
        b = int(m.group(2) or a)
        if a < 1 or b > count or a > b:
            raise UserError(f"Page range '{part}' is outside 1–{count}.")
        pages.extend(range(a - 1, b))
    return list(dict.fromkeys(pages))


def safe_dpi(page: fitz.Page, dpi: int) -> int:
    dpi = max(36, min(int(dpi or 150), MAX_RENDER_DPI))
    w, h = page.rect.width / 72 * dpi, page.rect.height / 72 * dpi
    if w * h > MAX_RENDER_PIXELS:
        dpi = int(dpi * (MAX_RENDER_PIXELS / (w * h)) ** 0.5)
    return max(36, dpi)


def _validate_pdf(path: Path) -> int:
    with fitz.open(path) as d:
        return d.page_count


def _zip_dir(files: list[tuple[Path, str]], dest: Path) -> None:
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as zf:
        for p, arc in files:
            zf.write(p, arc)


# ---------------------------------------------------------------------------
# PDF → DOCX
# ---------------------------------------------------------------------------


def to_docx(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    from pdf2docx import Converter

    password = opts.get("password") or None
    # Validate (and surface password errors nicely) before pdf2docx does.
    with open_pdf(inp.path, password) as d:
        n = d.page_count
    out = ctx.new_work_dir("docx") / "out.docx"
    cv = Converter(str(inp.path), password=password)
    try:
        try:
            # Fine-grained progress: replicate Converter.parse() page loop.
            settings = cv.default_settings
            settings.update({"multi_processing": False})
            ctx.progress(0.02, "Loading pages")
            cv.load_pages(0, None, None)
            ctx.check()
            ctx.progress(0.05, "Analysing document structure")
            cv.parse_document(**settings)
            pages = [p for p in cv.pages if not p.skip_parsing]
            for i, page in enumerate(pages):
                ctx.check()
                ctx.progress(0.05 + 0.85 * i / max(1, len(pages)), f"Reconstructing layout · page {i + 1} of {len(pages)}")
                page.parse(**settings)
            ctx.progress(0.92, "Writing DOCX")
            cv.make_docx(str(out), **settings)
        except (AttributeError, TypeError):
            # Internal API changed: fall back to the public one with indeterminate progress.
            ctx.progress(None, f"Converting {n} page(s) to DOCX")
            cv.convert(str(out))
    finally:
        cv.close()
    import docx  # validate

    try:
        docx.Document(str(out))
    except Exception as exc:
        raise UserError(f"The generated DOCX failed validation ({exc}).") from exc
    ctx.warn("Complex layouts, columns and vector graphics may not be reproduced exactly in Word.")
    ctx.add_output(out, output_name(inp.name, "docx"))


# ---------------------------------------------------------------------------
# PDF → PPTX
# ---------------------------------------------------------------------------


def _rgb(color: int) -> tuple[int, int, int]:
    return (color >> 16) & 255, (color >> 8) & 255, color & 255


def to_pptx(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.util import Emu, Pt

    mode = opts.get("mode", "hybrid")
    if mode not in ("hybrid", "image"):
        raise UserError("mode must be 'hybrid' or 'image'.")
    dpi = int(opts.get("dpi", 150))
    doc = open_pdf(inp.path, opts.get("password"))
    work = ctx.new_work_dir("pptx")
    try:
        first = doc[0].rect
        prs = Presentation()
        EMU_PER_PT = 12700
        prs.slide_width = Emu(int(first.width * EMU_PER_PT))
        prs.slide_height = Emu(int(first.height * EMU_PER_PT))
        blank = prs.slide_layouts[6]
        n = doc.page_count
        text_boxes = 0
        for i in range(n):
            ctx.check()
            ctx.progress(i / n, f"Building slide {i + 1} of {n}")
            page = doc[i]
            sx = prs.slide_width / (page.rect.width * EMU_PER_PT)
            sy = prs.slide_height / (page.rect.height * EMU_PER_PT)
            slide = prs.slides.add_slide(blank)
            lines: list[dict[str, Any]] = []
            if mode == "hybrid":
                td = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
                for block in td.get("blocks", []):
                    if block.get("type") != 0:
                        continue
                    for line in block.get("lines", []):
                        spans = [s for s in line.get("spans", []) if s.get("text", "").strip()]
                        if spans:
                            lines.append({"bbox": line["bbox"], "spans": spans, "dir": line.get("dir", (1, 0))})
                # Strip text from a copy of the page, keeping images and vector art.
                tmp = fitz.open()
                tmp.insert_pdf(doc, from_page=i, to_page=i)
                tp = tmp[0]
                for ln in lines:
                    tp.add_redact_annot(fitz.Rect(ln["bbox"]))
                if lines:
                    tp.apply_redactions(
                        images=fitz.PDF_REDACT_IMAGE_NONE,
                        graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                        text=fitz.PDF_REDACT_TEXT_REMOVE,
                    )
                pix = tp.get_pixmap(dpi=safe_dpi(tp, dpi))
                tmp.close()
            else:
                pix = page.get_pixmap(dpi=safe_dpi(page, dpi))
            img_path = work / f"p{i}.png"
            pix.save(img_path)
            slide.shapes.add_picture(str(img_path), 0, 0, prs.slide_width, prs.slide_height)
            for ln in lines:
                if abs(ln["dir"][1]) > 0.01:  # rotated text: python-pptx boxes can't match reliably
                    continue
                x0, y0, x1, y1 = ln["bbox"]
                box = slide.shapes.add_textbox(
                    Emu(int(x0 * EMU_PER_PT * sx)),
                    Emu(int(y0 * EMU_PER_PT * sy)),
                    Emu(int(max(4, (x1 - x0) * 1.04) * EMU_PER_PT * sx)),
                    Emu(int(max(4, y1 - y0) * EMU_PER_PT * sy)),
                )
                tf = box.text_frame
                tf.word_wrap = False
                for m in ("margin_left", "margin_right", "margin_top", "margin_bottom"):
                    setattr(tf, m, 0)
                p = tf.paragraphs[0]
                for s in ln["spans"]:
                    r = p.add_run()
                    r.text = s["text"]
                    r.font.size = Pt(max(1, round(s.get("size", 11) * sy, 1)))
                    r.font.color.rgb = RGBColor(*_rgb(int(s.get("color", 0))))
                    flags = int(s.get("flags", 0))
                    r.font.bold = bool(flags & 16) or "bold" in s.get("font", "").lower()
                    r.font.italic = bool(flags & 2)
                    fam = re.sub(r"^[A-Z]{6}\+", "", s.get("font", "")).split("-")[0]
                    if fam:
                        r.font.name = fam
                text_boxes += 1
        ctx.progress(0.97, "Saving presentation")
        out = work / "out.pptx"
        prs.save(str(out))
    finally:
        doc.close()
    Presentation(str(out))  # validate
    if mode == "hybrid":
        ctx.warn(
            "PDF to PowerPoint is a reconstruction: text is editable where it could be extracted, "
            "while graphics are kept as background images. Original animations and slide masters cannot be recovered."
        )
        if text_boxes == 0:
            ctx.warn("No extractable text was found (scanned PDF?) — slides are image-only. Run OCR first for editable text.")
    ctx.add_output(out, output_name(inp.name, "pptx"))


# ---------------------------------------------------------------------------
# PDF → XLSX
# ---------------------------------------------------------------------------


def to_xlsx(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    from openpyxl import Workbook, load_workbook
    from openpyxl.styles import Font

    doc = open_pdf(inp.path, opts.get("password"))
    wb = Workbook()
    wb.remove(wb.active)
    tables = 0
    text_rows: list[tuple[int, str]] = []
    try:
        n = doc.page_count
        for i in range(n):
            ctx.check()
            ctx.progress(i / n, f"Detecting tables · page {i + 1} of {n}")
            page = doc[i]
            try:
                found = page.find_tables()
                tlist = list(found.tables) if hasattr(found, "tables") else list(found)
            except Exception:
                tlist = []
            for t in tlist:
                rows = t.extract()
                if not rows or len(rows) < 1:
                    continue
                tables += 1
                ws = wb.create_sheet(title=f"P{i + 1} Table {tables}"[:31])
                for r_i, row in enumerate(rows, start=1):
                    for c_i, val in enumerate(row, start=1):
                        v = "" if val is None else str(val).replace("\n", " ").strip()
                        ws.cell(row=r_i, column=c_i, value=_numeric(v))
                        if r_i == 1:
                            ws.cell(row=r_i, column=c_i).font = Font(bold=True)
            for line in page.get_text("text").splitlines():
                if line.strip():
                    text_rows.append((i + 1, line))
    finally:
        doc.close()
    if tables == 0:
        ws = wb.create_sheet("Text")
        ws.append(["Page", "Line"])
        for row in text_rows:
            ws.append(list(row))
        ctx.warn("No ruled tables were detected; exported the text line by line into a 'Text' sheet instead.")
        if not text_rows:
            ctx.warn("The PDF has no extractable text (it may be scanned). Run OCR first.")
    out = ctx.new_work_dir("xlsx") / "out.xlsx"
    wb.save(out)
    load_workbook(out)  # validate
    ctx.add_output(out, output_name(inp.name, "xlsx"), note=f"{tables} table(s) detected" if tables else None)


def _numeric(v: str) -> Any:
    s = v.replace(",", "")
    if re.fullmatch(r"-?\d+", s) and len(s) < 16:
        return int(s)
    if re.fullmatch(r"-?\d*\.\d+", s):
        try:
            return float(s)
        except ValueError:
            pass
    return v


# ---------------------------------------------------------------------------
# PDF → HTML / SVG / TXT
# ---------------------------------------------------------------------------


def to_html(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    doc = open_pdf(inp.path, opts.get("password"))
    parts: list[str] = []
    try:
        n = doc.page_count
        for i in range(n):
            ctx.check()
            ctx.progress(i / n, f"Converting page {i + 1} of {n}")
            # "html" output embeds images as base64 and absolutely positions text.
            body = doc[i].get_text("html")
            parts.append(f'<section class="page" id="page-{i + 1}">{body}</section>')
        title = html.escape(doc.metadata.get("title") or Path(inp.name).stem)
    finally:
        doc.close()
    page_html = (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<title>{title}</title><meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<style>body{background:#e5e7eb;margin:0;padding:24px;font-family:sans-serif}"
        ".page{margin:0 auto 24px;width:fit-content;box-shadow:0 2px 12px rgba(0,0,0,.15);background:#fff}"
        ".page>div{position:relative}</style></head><body>" + "\n".join(parts) + "</body></html>"
    )
    out = ctx.new_work_dir("html") / "out.html"
    out.write_text(page_html, encoding="utf-8")
    ctx.add_output(out, output_name(inp.name, "html"))


def to_svg(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    doc = open_pdf(inp.path, opts.get("password"))
    work = ctx.new_work_dir("svg")
    files: list[tuple[Path, str]] = []
    try:
        pages = parse_page_ranges(opts.get("pages"), doc.page_count)
        stem = Path(inp.name).stem
        for k, i in enumerate(pages):
            ctx.check()
            ctx.progress(k / len(pages), f"Vectorising page {i + 1}")
            svg = doc[i].get_svg_image(text_as_path=True)
            p = work / f"{stem}-page-{i + 1}.svg"
            p.write_text(svg, encoding="utf-8")
            files.append((p, p.name))
    finally:
        doc.close()
    if len(files) == 1:
        ctx.add_output(files[0][0], files[0][1])
    else:
        z = work / "out.zip"
        _zip_dir(files, z)
        ctx.add_output(z, output_name(inp.name, "zip", "-svg"), note=f"{len(files)} SVG pages")


def to_txt(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    doc = open_pdf(inp.path, opts.get("password"))
    chunks: list[str] = []
    try:
        n = doc.page_count
        for i in range(n):
            ctx.check()
            ctx.progress(i / n, f"Extracting text · page {i + 1} of {n}")
            chunks.append(doc[i].get_text("text", sort=True))
    finally:
        doc.close()
    text = "\n\f\n".join(chunks)
    if not text.strip():
        ctx.warn("No text layer was found — this looks like a scanned PDF. Use OCR PDF to recognise the text.")
    out = ctx.new_work_dir("txt") / "out.txt"
    out.write_text(text, encoding="utf-8")
    ctx.add_output(out, output_name(inp.name, "txt"))


# ---------------------------------------------------------------------------
# Compress / protect / unlock / repair
# ---------------------------------------------------------------------------

_COMPRESS_LEVELS = {
    "low": {"dpi_threshold": 260, "dpi_target": 200, "quality": 85},
    "balanced": {"dpi_threshold": 180, "dpi_target": 144, "quality": 70},
    "max": {"dpi_threshold": 110, "dpi_target": 96, "quality": 50},
}


def compress(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    level = opts.get("level", "balanced")
    if level not in _COMPRESS_LEVELS:
        raise UserError("level must be low, balanced or max.")
    params = _COMPRESS_LEVELS[level]
    doc = open_pdf(inp.path, opts.get("password"))
    out = ctx.new_work_dir("compress") / "out.pdf"
    try:
        ctx.progress(None, "Recompressing images")
        try:
            doc.rewrite_images(
                dpi_threshold=params["dpi_threshold"],
                dpi_target=params["dpi_target"],
                quality=params["quality"],
                lossy=True,
                lossless=True,
                bitonal=True,
                color=True,
                gray=True,
            )
        except Exception as exc:  # some exotic image types can't be rewritten
            ctx.warn(f"Some images could not be recompressed ({type(exc).__name__}).")
        ctx.check()
        if level == "max":
            try:
                doc.subset_fonts()
            except Exception:
                pass
        ctx.progress(None, "Removing unused objects and compressing streams")
        doc.save(
            out,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
            use_objstms=1,
        )
    finally:
        doc.close()
    _validate_pdf(out)
    before, after = inp.size, out.stat().st_size
    name = output_name(inp.name, "pdf", "-compressed")
    if after >= before:
        shutil.copyfile(inp.path, out)
        ctx.add_output(out, name, note="Already optimized; no smaller version produced.")
    else:
        pct = (1 - after / before) * 100
        ctx.add_output(out, name, note=f"Reduced by {pct:.1f}%")


def protect(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    import pikepdf

    user_pw = str(opts.get("userPassword") or "")
    if len(user_pw) < 1:
        raise UserError("Enter a password to protect the PDF.")
    owner_pw = str(opts.get("ownerPassword") or user_pw)
    perms = pikepdf.Permissions(
        print_lowres=bool(opts.get("allowPrint", True)),
        print_highres=bool(opts.get("allowPrint", True)),
        extract=bool(opts.get("allowCopy", True)),
        accessibility=True,
        modify_annotation=bool(opts.get("allowModify", True)),
        modify_assembly=bool(opts.get("allowModify", True)),
        modify_form=bool(opts.get("allowModify", True)),
        modify_other=bool(opts.get("allowModify", True)),
    )
    ctx.progress(None, "Encrypting with AES-256")
    try:
        pdf = pikepdf.open(inp.path)
    except pikepdf.PasswordError as exc:
        raise UserError("This PDF is already password-protected. Unlock it first.") from exc
    except pikepdf.PdfError as exc:
        raise UserError(f"Could not read this PDF ({exc}). Try Repair PDF first.") from exc
    out = ctx.new_work_dir("protect") / "out.pdf"
    with pdf:
        pdf.save(out, encryption=pikepdf.Encryption(user=user_pw, owner=owner_pw, R=6, allow=perms))
    # validate: must require the password
    with fitz.open(out) as d:
        if not d.needs_pass or not d.authenticate(user_pw):
            raise UserError("Encryption validation failed.")
    ctx.add_output(out, output_name(inp.name, "pdf", "-protected"))


def unlock(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    import pikepdf

    password = str(opts.get("password") or "")
    ctx.progress(None, "Decrypting")
    try:
        pdf = pikepdf.open(inp.path, password=password)
    except pikepdf.PasswordError as exc:
        raise UserError("Incorrect password." if password else "This PDF needs a password to unlock.") from exc
    except pikepdf.PdfError as exc:
        raise UserError(f"Could not read this PDF ({exc}).") from exc
    out = ctx.new_work_dir("unlock") / "out.pdf"
    with pdf:
        was_encrypted = pdf.is_encrypted
        pdf.save(out)  # saving without `encryption=` writes an unencrypted file
    _validate_pdf(out)
    note = None if was_encrypted else "This PDF was not encrypted; saved an unchanged copy."
    ctx.add_output(out, output_name(inp.name, "pdf", "-unlocked"), note=note)


def repair(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    import pikepdf

    out = ctx.new_work_dir("repair") / "out.pdf"
    notes: list[str] = []
    ctx.progress(None, "Rebuilding document structure (qpdf)")
    try:
        with pikepdf.open(inp.path, password=opts.get("password") or "", attempt_recovery=True) as pdf:
            warnings = pdf.get_warnings()
            pdf.remove_unreferenced_resources()
            pdf.save(out, fix_metadata_version=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
        if warnings:
            notes.append(f"qpdf fixed {len(warnings)} problem(s)")
            for w in warnings[:3]:
                ctx.warn(f"Repaired: {w[:180]}")
    except pikepdf.PasswordError as exc:
        raise UserError("This PDF is password-protected. Provide the password.") from exc
    except Exception as exc:
        ctx.warn(f"qpdf could not repair the file ({type(exc).__name__}); trying MuPDF reconstruction.")
        ctx.progress(None, "Reconstructing with MuPDF")
        try:
            doc = fitz.open(inp.path, filetype="pdf")
            if doc.page_count == 0:
                raise UserError("No recoverable pages were found in this file.")
            doc.save(out, garbage=4, deflate=True, clean=True)
            doc.close()
            notes.append("Reconstructed by MuPDF")
        except UserError:
            raise
        except Exception as exc2:
            raise UserError(
                f"The file is too badly damaged to repair ({type(exc2).__name__}: {exc2})."
            ) from exc2
    pages = _validate_pdf(out)
    note = "; ".join(notes) if notes else "No structural problems detected; rewrote a clean copy."
    ctx.add_output(out, output_name(inp.name, "pdf", "-repaired"), note=f"{note} · {pages} page(s)")


# ---------------------------------------------------------------------------
# Extract images
# ---------------------------------------------------------------------------


def extract_images(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    min_size = int(opts.get("minSize", 32))
    doc = open_pdf(inp.path, opts.get("password"))
    work = ctx.new_work_dir("img")
    seen: set[int] = set()
    files: list[tuple[Path, str]] = []
    stem = Path(inp.name).stem
    try:
        n = doc.page_count
        for i in range(n):
            ctx.check()
            ctx.progress(i / n, f"Scanning page {i + 1} of {n}")
            for img in doc[i].get_images(full=True):
                xref = img[0]
                if xref in seen:
                    continue
                seen.add(xref)
                try:
                    info = doc.extract_image(xref)
                except Exception:
                    continue
                if not info or info.get("width", 0) < min_size or info.get("height", 0) < min_size:
                    continue
                ext = info.get("ext", "png")
                data = info["image"]
                if info.get("smask"):
                    # Re-compose with the soft mask so transparency is preserved.
                    try:
                        pix = fitz.Pixmap(doc, xref)
                        mask = fitz.Pixmap(doc, info["smask"])
                        pix = fitz.Pixmap(pix, mask)
                        if pix.colorspace and pix.colorspace.n > 3:
                            pix = fitz.Pixmap(fitz.csRGB, pix)
                        data, ext = pix.tobytes("png"), "png"
                    except Exception:
                        pass
                name = f"{stem}-p{i + 1}-{len(files) + 1}.{ext}"
                p = work / name
                p.write_bytes(data)
                files.append((p, name))
    finally:
        doc.close()
    if not files:
        raise UserError("No embedded images found in this PDF.")
    z = work / "images.zip"
    _zip_dir(files, z)
    ctx.add_output(z, output_name(inp.name, "zip", "-images"), note=f"{len(files)} image(s)")


__all__ = [
    "to_docx",
    "to_pptx",
    "to_xlsx",
    "to_html",
    "to_svg",
    "to_txt",
    "compress",
    "protect",
    "unlock",
    "repair",
    "extract_images",
    "open_pdf",
    "parse_page_ranges",
    "safe_dpi",
]
