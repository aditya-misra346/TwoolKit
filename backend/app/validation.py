"""File-type detection by magic bytes and filename sanitization.

We never trust the client-provided MIME type. The detected type is derived from
file content; the extension is used only to disambiguate between text formats
(csv vs tsv vs md vs txt) or OLE2 sub-types when content inspection is
inconclusive.
"""

from __future__ import annotations

import re
import unicodedata
import zipfile
from pathlib import Path

from .config import MAX_FILENAME_CHARS

# Detected type -> canonical extension / MIME type for outputs and downloads.
MIME_BY_EXT: dict[str, str] = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "odt": "application/vnd.oasis.opendocument.text",
    "ods": "application/vnd.oasis.opendocument.spreadsheet",
    "odp": "application/vnd.oasis.opendocument.presentation",
    "doc": "application/msword",
    "xls": "application/vnd.ms-excel",
    "ppt": "application/vnd.ms-powerpoint",
    "rtf": "application/rtf",
    "txt": "text/plain; charset=utf-8",
    "csv": "text/csv; charset=utf-8",
    "tsv": "text/tab-separated-values; charset=utf-8",
    "json": "application/json",
    "xml": "application/xml",
    "md": "text/markdown; charset=utf-8",
    "html": "text/html; charset=utf-8",
    "svg": "image/svg+xml",
    "png": "image/png",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "avif": "image/avif",
    "heic": "image/heic",
    "heif": "image/heif",
    "bmp": "image/bmp",
    "tiff": "image/tiff",
    "ico": "image/vnd.microsoft.icon",
    "zip": "application/zip",
    "mp4": "video/mp4",
    "webm": "video/webm",
}

TEXT_TYPES = {"csv", "tsv", "json", "xml", "md", "html", "txt"}

# Extension aliases -> canonical detected type names.
_EXT_ALIASES = {
    "jpg": "jpeg",
    "jpe": "jpeg",
    "jfif": "jpeg",
    "tif": "tiff",
    "htm": "html",
    "xhtml": "html",
    "markdown": "md",
    "text": "txt",
    "log": "txt",
    "tab": "tsv",
}

_HEIC_BRANDS = {b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"hevm", b"hevs"}
_HEIF_BRANDS = {b"mif1", b"msf1", b"mif2"}
_AVIF_BRANDS = {b"avif", b"avis"}

_BAD_CHARS = re.compile(r"[\x00-\x1f\x7f/\\:*?\"<>|]")
# Bidi controls & zero-width chars are used for extension spoofing ("gpj.exe").
_BIDI_CHARS = re.compile("[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]")


def mime_for(ext: str) -> str:
    return MIME_BY_EXT.get(ext.lower().lstrip("."), "application/octet-stream")


def normalize_ext(name: str) -> str:
    ext = Path(name).suffix.lower().lstrip(".")
    return _EXT_ALIASES.get(ext, ext)


def sanitize_filename(raw: str | None, fallback: str = "file") -> str:
    """Return a safe basename: no path parts, control/bidi chars, or reserved names."""
    name = (raw or "").replace("\\", "/").split("/")[-1]
    name = unicodedata.normalize("NFC", name)
    name = _BIDI_CHARS.sub("", name)
    name = _BAD_CHARS.sub("_", name)
    name = name.strip().strip(".").strip()
    if not name:
        name = fallback
    if len(name) > MAX_FILENAME_CHARS:
        p = Path(name)
        suffix = p.suffix[:16]
        name = p.stem[: MAX_FILENAME_CHARS - len(suffix)] + suffix
    return name


def output_name(input_name: str, new_ext: str, suffix: str = "") -> str:
    stem = Path(input_name).stem or "output"
    return sanitize_filename(f"{stem}{suffix}.{new_ext}")


# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------


def _detect_zip(path: Path) -> str:
    try:
        with zipfile.ZipFile(path) as zf:
            names = zf.namelist()
            name_set = set(names)
            if "mimetype" in name_set:
                try:
                    mt = zf.read("mimetype")[:100].decode("ascii", "ignore").strip()
                except Exception:
                    mt = ""
                if mt == "application/vnd.oasis.opendocument.text":
                    return "odt"
                if mt == "application/vnd.oasis.opendocument.spreadsheet":
                    return "ods"
                if mt == "application/vnd.oasis.opendocument.presentation":
                    return "odp"
            if "[Content_Types].xml" in name_set:
                if any(n.startswith("word/") for n in names):
                    return "docx"
                if any(n.startswith("xl/") for n in names):
                    return "xlsx"
                if any(n.startswith("ppt/") for n in names):
                    return "pptx"
    except (zipfile.BadZipFile, OSError):
        return "unknown"
    return "zip"


_OLE_MARKERS = {
    "doc": "WordDocument".encode("utf-16-le"),
    "xls": "Workbook".encode("utf-16-le"),
    "xls_old": "Book".encode("utf-16-le"),
    "ppt": "PowerPoint Document".encode("utf-16-le"),
}


def _detect_ole(path: Path, ext: str) -> str:
    """Distinguish legacy doc/xls/ppt by scanning for OLE directory stream names."""
    found: set[str] = set()
    overlap = 64
    tail = b""
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(4 * 1024 * 1024)
            if not chunk:
                break
            buf = tail + chunk
            for key, marker in _OLE_MARKERS.items():
                if marker in buf:
                    found.add(key.split("_")[0])
            if len(found) >= 1 and ext in found:
                return ext
            tail = buf[-overlap:]
    if ext in found:
        return ext
    for t in ("ppt", "doc", "xls"):  # PowerPoint files may also contain "Workbook"
        if t in found:
            return t
    return "ole2"


def _looks_textual(sample: bytes) -> str | None:
    """Return decoded text if the sample looks like text, else None."""
    if not sample:
        return ""
    if sample.startswith((b"\xff\xfe", b"\xfe\xff")):
        try:
            return sample.decode("utf-16", "strict")
        except UnicodeDecodeError:
            # Truncated sample may split a code unit; retry trimmed.
            try:
                return sample[: len(sample) - (len(sample) % 2)].decode("utf-16")
            except UnicodeDecodeError:
                return None
    if b"\x00" in sample:
        return None
    try:
        return sample.decode("utf-8")
    except UnicodeDecodeError as exc:
        # A multibyte char may be cut at the sample boundary.
        if exc.start >= len(sample) - 4:
            try:
                return sample[: exc.start].decode("utf-8")
            except UnicodeDecodeError:
                pass
    # Legacy 8-bit encodings: accept if control characters are rare.
    ctrl = sum(1 for b in sample if b < 9 or (13 < b < 32))
    if ctrl / len(sample) < 0.01:
        return sample.decode("latin-1")
    return None


def _detect_text(text: str, ext: str) -> str:
    head = text.lstrip("\ufeff \t\r\n")[:2048]
    low = head.lower()
    if low.startswith("<!doctype html") or low.startswith("<html") or (
        ext == "html" and head.startswith("<")
    ):
        return "html"
    if low.startswith("<?xml") or (ext in {"xml", "svg"} and head.startswith("<")):
        if "<html" in low[:1024] and ext == "html":
            return "html"
        if "<svg" in low:
            return "svg"
        return "xml"
    if head.startswith(("{", "[")) and ext in {"json", "", "txt"}:
        return "json"
    if ext in {"csv", "tsv", "md", "txt", "json"}:
        # A .json that doesn't start with { or [ is not JSON: report as txt.
        return "txt" if ext == "json" else ext
    if head.startswith("{\\rtf"):
        return "rtf"
    return "txt"


def detect_type(path: Path, claimed_name: str) -> str:
    """Detect a file's real type from its content (plus extension for text tie-breaks)."""
    ext = normalize_ext(claimed_name)
    with path.open("rb") as fh:
        head = fh.read(8192)
    if not head:
        return "empty"
    if b"%PDF-" in head[:1024]:
        return "pdf"
    if head.startswith(b"PK\x03\x04"):
        return _detect_zip(path)
    if head.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return _detect_ole(path, ext)
    if head.startswith(b"{\\rtf"):
        return "rtf"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head[4:8] == b"ftyp":
        box_len = int.from_bytes(head[0:4], "big")
        major = head[8:12]
        brands = {major}
        for i in range(16, min(box_len, len(head)) - 3, 4):
            brands.add(head[i : i + 4])
        if brands & _AVIF_BRANDS:
            return "avif"
        if brands & _HEIC_BRANDS:
            return "heic"
        if brands & _HEIF_BRANDS:
            return "heif"
        return "unknown"
    if head[:2] == b"BM" and len(head) > 26:
        return "bmp"
    if head[:4] in (b"II*\x00", b"MM\x00*"):
        return "tiff"
    if head[:4] == b"\x00\x00\x01\x00":
        return "ico"
    text = _looks_textual(head)
    if text is not None:
        return _detect_text(text, ext)
    return "unknown"
