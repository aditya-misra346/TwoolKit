"""Server-side image conversion (fallback for formats browsers can't decode/encode)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ..config import MAX_IMAGE_PIXELS
from ..jobs import InputFile, JobContext, UserError
from ..validation import output_name

TARGETS = {"jpeg", "png", "webp", "avif", "gif", "bmp", "tiff", "ico"}
NO_ALPHA = {"jpeg", "bmp"}


def _open(path: Path):
    from PIL import Image, ImageOps

    Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
    try:
        import pillow_heif

        pillow_heif.register_heif_opener()
    except Exception:
        pass
    try:
        img = Image.open(path)
        img.load()
    except Image.DecompressionBombError as exc:
        raise UserError("This image is too large to process safely.") from exc
    except Exception as exc:
        raise UserError(f"This image could not be decoded ({type(exc).__name__}). It may be corrupted or unsupported.") from exc
    # honour EXIF orientation so the output looks like the original
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass
    return img


def _hex_rgb(s: str) -> tuple[int, int, int]:
    s = (s or "#ffffff").lstrip("#")
    if len(s) == 3:
        s = "".join(c * 2 for c in s)
    try:
        return int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)
    except ValueError:
        return 255, 255, 255


def convert(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    from PIL import Image

    target = str(opts.get("target", "")).lower().replace("jpg", "jpeg").replace("tif", "tiff").replace("tifff", "tiff")
    if target not in TARGETS:
        raise UserError(f"Unsupported target format. Choose one of: {', '.join(sorted(TARGETS))}.")
    quality = max(1, min(100, int(opts.get("quality", 85))))
    keep_meta = bool(opts.get("keepMetadata", False))
    ctx.progress(0.1, "Decoding image")
    img = _open(inp.path)
    exif = img.info.get("exif") if keep_meta else None
    icc = img.info.get("icc_profile")
    w, h = opts.get("width"), opts.get("height")
    if w or h:
        w = int(w) if w else None
        h = int(h) if h else None
        if w and not h:
            h = max(1, round(img.height * w / img.width))
        if h and not w:
            w = max(1, round(img.width * h / img.height))
        if not (1 <= w <= 20000 and 1 <= h <= 20000):
            raise UserError("Width and height must be between 1 and 20000 px.")
        img = img.resize((w, h), Image.Resampling.LANCZOS)
    ctx.check()
    has_alpha = img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info)
    if target in NO_ALPHA:
        if has_alpha:
            bg = Image.new("RGB", img.size, _hex_rgb(opts.get("background", "#ffffff")))
            rgba = img.convert("RGBA")
            bg.paste(rgba, mask=rgba.split()[-1])
            img = bg
            ctx.warn(f"{target.upper()} doesn't support transparency; transparent areas were filled with {opts.get('background', '#ffffff')}.")
        else:
            img = img.convert("RGB")
    elif img.mode not in ("RGB", "RGBA", "L", "LA", "P"):
        img = img.convert("RGBA" if has_alpha else "RGB")

    ctx.progress(0.6, f"Encoding {target.upper()}")
    ext = {"jpeg": "jpg", "tiff": "tiff"}.get(target, target)
    out = ctx.new_work_dir("img") / f"out.{ext}"
    kw: dict[str, Any] = {}
    if icc:
        kw["icc_profile"] = icc
    if exif:
        kw["exif"] = exif
    if target == "jpeg":
        kw.update(quality=quality, optimize=True, progressive=True)
    elif target == "png":
        kw.update(optimize=True)
    elif target == "webp":
        kw.update(quality=quality, method=5)
    elif target == "avif":
        kw.update(quality=quality, speed=6)
    elif target == "tiff":
        kw.update(compression="tiff_lzw")
        kw.pop("exif", None)
    elif target == "ico":
        if max(img.size) > 256:
            img.thumbnail((256, 256))
            ctx.warn("ICO icons are limited to 256×256; the image was scaled down.")
        kw = {"sizes": [s for s in [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)] if s[0] <= max(img.size)] or [img.size]}
    elif target == "gif":
        if img.mode not in ("P", "L"):
            img = img.convert("RGBA" if has_alpha else "RGB").quantize(colors=256, method=Image.Quantize.FASTOCTREE if has_alpha else Image.Quantize.MEDIANCUT)
        ctx.warn("GIF is limited to 256 colours; photos may show banding.")
    elif target == "bmp":
        kw = {}
    try:
        img.save(out, target.upper(), **kw)
    except Exception as exc:
        raise UserError(f"Encoding {target.upper()} failed ({exc}).") from exc
    # validate output
    with Image.open(out) as chk:
        chk.verify()
    ctx.add_output(out, output_name(inp.name, ext))


def remove_bg(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    try:
        from rembg import remove  # type: ignore
    except Exception as exc:
        raise UserError("Background removal is not installed on this server (rembg).") from exc
    ctx.progress(None, "Segmenting foreground (rembg)")
    img = _open(inp.path)
    result = remove(img)
    out = ctx.new_work_dir("rembg") / "out.png"
    result.save(out, "PNG", optimize=True)
    ctx.add_output(out, output_name(inp.name, "png", "-no-bg"))
