"""Dynamic engine/capability detection.

Detection results are cached for ``CAPABILITIES_CACHE_SECONDS`` so that engines
installed while the server is running (e.g. LibreOffice) light up without a
restart. The OpenCV codec probe is expensive and is cached for the process
lifetime.
"""

from __future__ import annotations

import importlib.metadata
import importlib.util
import os
import plistlib
import shutil
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from . import config

_LOCK = threading.Lock()
_CACHE: dict[str, Any] = {"at": 0.0, "value": None}
_VIDEO_CODEC: dict[str, Any] | None = None
_VIDEO_LOCK = threading.Lock()

_EXTRA_BIN_DIRS = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"]


def _which(name: str) -> str | None:
    found = shutil.which(name)
    if found:
        return found
    for d in _EXTRA_BIN_DIRS:
        p = Path(d) / name
        if p.is_file() and os.access(p, os.X_OK):
            return str(p)
    return None


def _pkg_version(dist: str) -> str | None:
    try:
        return importlib.metadata.version(dist)
    except importlib.metadata.PackageNotFoundError:
        return None


# ---------------------------------------------------------------------------
# LibreOffice
# ---------------------------------------------------------------------------

_MAC_SOFFICE = Path("/Applications/LibreOffice.app/Contents/MacOS/soffice")


def find_soffice() -> str | None:
    """Locate the soffice binary (macOS app bundle first, then PATH)."""
    env = os.environ.get("VELLUM_SOFFICE")
    if env and Path(env).is_file():
        return env
    if _MAC_SOFFICE.is_file() and os.access(_MAC_SOFFICE, os.X_OK):
        return str(_MAC_SOFFICE)
    home_app = Path.home() / "Applications/LibreOffice.app/Contents/MacOS/soffice"
    if home_app.is_file():
        return str(home_app)
    return _which("soffice") or _which("libreoffice")


_LO_VERSION_CACHE: dict[str, str | None] = {}


def _libreoffice_version(soffice: str) -> str | None:
    if soffice in _LO_VERSION_CACHE:
        return _LO_VERSION_CACHE[soffice]
    version: str | None = None
    plist = Path(soffice).parent.parent / "Info.plist"
    if plist.is_file():
        try:
            with plist.open("rb") as fh:
                version = plistlib.load(fh).get("CFBundleShortVersionString")
        except Exception:
            version = None
    if version is None:
        try:
            out = subprocess.run(
                [soffice, "--version"], capture_output=True, text=True, timeout=30
            ).stdout
            parts = out.split()
            version = parts[1] if len(parts) > 1 else out.strip() or None
        except Exception:
            version = None
    _LO_VERSION_CACHE[soffice] = version
    return version


# ---------------------------------------------------------------------------
# Video codec probe
# ---------------------------------------------------------------------------

# (fourcc, container extension, label) in preference order.
VIDEO_CANDIDATES: list[tuple[str, str, str]] = [
    ("avc1", "mp4", "avc1"),
    ("VP80", "webm", "vp80"),
    ("mp4v", "mp4", "mp4v"),
]


def probe_video_codec() -> dict[str, Any]:
    """Find the first OpenCV VideoWriter codec that actually produces a readable file."""
    global _VIDEO_CODEC
    with _VIDEO_LOCK:
        if _VIDEO_CODEC is not None:
            return _VIDEO_CODEC
        result: dict[str, Any] = {"available": False, "detail": "OpenCV not installed"}
        try:
            import cv2
            import numpy as np
        except Exception:
            _VIDEO_CODEC = result
            return result
        tried: list[str] = []
        with tempfile.TemporaryDirectory(prefix="vellum_probe_") as tmp:
            frame = np.zeros((64, 64, 3), dtype=np.uint8)
            frame[:, :32] = (40, 120, 200)
            for fourcc, ext, label in VIDEO_CANDIDATES:
                path = os.path.join(tmp, f"probe_{label}.{ext}")
                try:
                    writer = cv2.VideoWriter(
                        path, cv2.VideoWriter_fourcc(*fourcc), 5.0, (64, 64)
                    )
                    if not writer.isOpened():
                        tried.append(f"{label}: writer failed to open")
                        continue
                    for _ in range(5):
                        writer.write(frame)
                    writer.release()
                    cap = cv2.VideoCapture(path)
                    ok, _frame = cap.read()
                    cap.release()
                    if ok and os.path.getsize(path) > 0:
                        result = {
                            "available": True,
                            "codec": label,
                            "fourcc": fourcc,
                            "container": ext,
                            "detail": f"OpenCV {cv2.__version__}; tried: "
                            + (", ".join(tried) if tried else "first choice worked"),
                        }
                        break
                    tried.append(f"{label}: output unreadable")
                except Exception as exc:  # pragma: no cover - platform dependent
                    tried.append(f"{label}: {exc}")
            else:
                result = {
                    "available": False,
                    "detail": "No working OpenCV codec (" + "; ".join(tried) + ")",
                }
        _VIDEO_CODEC = result
        return result


# ---------------------------------------------------------------------------
# Engines
# ---------------------------------------------------------------------------


@dataclass
class Engines:
    raw: dict[str, dict[str, Any]]

    def ok(self, name: str) -> bool:
        return bool(self.raw.get(name, {}).get("available"))


def _detect_engines() -> dict[str, dict[str, Any]]:
    engines: dict[str, dict[str, Any]] = {}

    soffice = find_soffice()
    if soffice:
        engines["libreoffice"] = {
            "available": True,
            "version": _libreoffice_version(soffice),
            "detail": soffice,
        }
    else:
        engines["libreoffice"] = {
            "available": False,
            "version": None,
            "detail": "Install with `brew install --cask libreoffice`",
        }

    try:
        import fitz

        engines["pymupdf"] = {"available": True, "version": fitz.VersionBind}
    except Exception as exc:
        engines["pymupdf"] = {"available": False, "detail": f"pip install pymupdf ({exc})"}

    engines["pdf2docx"] = {
        "available": importlib.util.find_spec("pdf2docx") is not None,
        "version": _pkg_version("pdf2docx"),
    }
    engines["pikepdf"] = {
        "available": importlib.util.find_spec("pikepdf") is not None,
        "version": _pkg_version("pikepdf"),
    }

    pillow: dict[str, Any] = {"available": False, "heif": False, "avif": False}
    try:
        import PIL
        from PIL import features

        pillow["available"] = True
        pillow["version"] = PIL.__version__
        try:
            pillow["avif"] = bool(features.check("avif"))
        except Exception:
            pillow["avif"] = False
        try:
            import pillow_heif  # noqa: F401

            pillow["heif"] = True
        except Exception:
            pillow["heif"] = False
    except Exception:
        pass
    engines["pillow"] = pillow

    tess = _which("tesseract")
    engines["tesseract"] = (
        {"available": True, "detail": tess}
        if tess
        else {"available": False, "detail": "Install with `brew install tesseract`"}
    )

    clam = _which("clamdscan") or _which("clamscan")
    engines["clamav"] = (
        {"available": True, "detail": clam}
        if clam
        else {
            "available": False,
            "detail": "Install ClamAV (`brew install clamav`) and run freshclam",
        }
    )

    gs = _which("gs")
    engines["ghostscript"] = (
        {"available": True, "detail": gs}
        if gs
        else {"available": False, "detail": "Install with `brew install ghostscript`"}
    )

    engines["rembg"] = (
        {"available": True, "version": _pkg_version("rembg")}
        if importlib.util.find_spec("rembg") is not None
        else {"available": False, "detail": "pip install rembg (downloads ~170MB model)"}
    )

    engines["video"] = probe_video_codec()
    return engines


def get_engines(force: bool = False) -> Engines:
    with _LOCK:
        now = time.monotonic()
        if (
            force
            or _CACHE["value"] is None
            or now - _CACHE["at"] > config.CAPABILITIES_CACHE_SECONDS
        ):
            _CACHE["value"] = _detect_engines()
            _CACHE["at"] = now
        return Engines(_CACHE["value"])


def clamav_binary() -> str | None:
    return _which("clamdscan") or _which("clamscan")


# ---------------------------------------------------------------------------
# Op availability
# ---------------------------------------------------------------------------


def op_availability(engines: Engines) -> dict[str, dict[str, Any]]:
    lo = engines.ok("libreoffice")
    mu = engines.ok("pymupdf")
    lo_note = None if lo else "LibreOffice not installed; only PDF input is supported."

    def avail(ok: bool, reason: str | None) -> dict[str, Any]:
        return {"available": ok, "reason": None if ok else reason}

    ops: dict[str, dict[str, Any]] = {
        "pdf.to_docx": avail(engines.ok("pdf2docx"), "pdf2docx not installed"),
        "pdf.to_pptx": avail(mu, "PyMuPDF not installed"),
        "pdf.to_xlsx": avail(mu, "PyMuPDF not installed"),
        "pdf.to_html": avail(mu, "PyMuPDF not installed"),
        "pdf.to_svg": avail(mu, "PyMuPDF not installed"),
        "pdf.to_txt": avail(mu, "PyMuPDF not installed"),
        "pdf.compress": avail(mu, "PyMuPDF not installed"),
        "pdf.protect": avail(engines.ok("pikepdf"), "pikepdf not installed"),
        "pdf.unlock": avail(engines.ok("pikepdf"), "pikepdf not installed"),
        "pdf.repair": avail(engines.ok("pikepdf") or mu, "pikepdf/PyMuPDF not installed"),
        "pdf.extract_images": avail(mu, "PyMuPDF not installed"),
        "office.convert": avail(lo, "LibreOffice not installed (`brew install --cask libreoffice`)"),
        "office.to_images": {"available": mu, "reason": lo_note if mu else "PyMuPDF not installed"},
        "office.to_video": {
            "available": mu and engines.ok("video"),
            "reason": (lo_note if mu and engines.ok("video") else "No working video codec / PyMuPDF missing"),
        },
        "data.convert": {
            "available": True,
            "reason": None
            if lo
            else "LibreOffice not installed; PDF/DOCX targets use built-in fallback renderers.",
        },
        "image.convert": avail(engines.ok("pillow"), "Pillow not installed"),
        "image.remove_bg": avail(
            engines.ok("rembg"), "rembg not installed (pip install rembg, downloads ~170MB model)"
        ),
        "security.clamav": avail(
            engines.ok("clamav"), "ClamAV not installed (`brew install clamav` + freshclam)"
        ),
    }
    return ops


def capabilities_payload() -> dict[str, Any]:
    engines = get_engines()
    return {
        "engines": engines.raw,
        "ops": op_availability(engines),
        "limits": {
            "maxFileMB": config.MAX_FILE_MB,
            "maxFilesPerJob": config.MAX_FILES_PER_JOB,
            "maxJobTotalMB": config.MAX_JOB_TOTAL_MB,
            "retentionMinutes": config.RETENTION_MINUTES,
        },
    }
