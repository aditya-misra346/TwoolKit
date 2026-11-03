"""Central configuration for the TWOOLKIT processing backend.

All values can be overridden with environment variables prefixed ``VELLUM_``.
"""

from __future__ import annotations

import os
from pathlib import Path

VERSION = "1.0.0"


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(f"VELLUM_{name}", default))
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(f"VELLUM_{name}")
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


BACKEND_DIR = Path(__file__).resolve().parent.parent
VAR_DIR = Path(os.environ.get("VELLUM_VAR_DIR", BACKEND_DIR / "var")).resolve()
JOBS_DIR = VAR_DIR / "jobs"
LO_PROFILE_DIR = VAR_DIR  # profiles live at var/lo_profile_<n>
CACHE_DIR = VAR_DIR / "cache"

# --- Limits -----------------------------------------------------------------
MAX_FILE_MB = _env_int("MAX_FILE_MB", 200)
MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024
MAX_FILES_PER_JOB = _env_int("MAX_FILES_PER_JOB", 20)
# Additional guard against disk exhaustion: total bytes uploaded in one job.
MAX_JOB_TOTAL_MB = _env_int("MAX_JOB_TOTAL_MB", 1024)
MAX_JOB_TOTAL_BYTES = MAX_JOB_TOTAL_MB * 1024 * 1024
MAX_FILENAME_CHARS = 180

RETENTION_MINUTES = _env_int("RETENTION_MINUTES", 30)
CLEANUP_INTERVAL_SECONDS = 60

# --- Job execution ------------------------------------------------------------
WORKERS = max(1, min(_env_int("WORKERS", 3), 8))
MAX_QUEUED_JOBS = _env_int("MAX_QUEUED_JOBS", 100)
LIBREOFFICE_TIMEOUT_SECONDS = _env_int("LIBREOFFICE_TIMEOUT", 180)
DEFAULT_OP_TIMEOUT_SECONDS = _env_int("OP_TIMEOUT", 900)
CLAMAV_TIMEOUT_SECONDS = _env_int("CLAMAV_TIMEOUT", 300)

# --- Rendering guards ---------------------------------------------------------
MAX_RENDER_DPI = 600
MAX_RENDER_PIXELS = 60_000_000  # per rendered page
MAX_IMAGE_PIXELS = 150_000_000  # Pillow decompression-bomb guard

# --- Rate limiting (token bucket, per client IP, job creation only) ----------
RATE_LIMIT_CAPACITY = _env_int("RATE_LIMIT_CAPACITY", 60)
RATE_LIMIT_WINDOW_SECONDS = _env_int("RATE_LIMIT_WINDOW", 300)
# The Next.js dev server proxies /api/* so the direct peer is loopback; only then
# do we trust X-Forwarded-For / X-Forwarded-Proto.
TRUST_LOOPBACK_PROXY = _env_bool("TRUST_LOOPBACK_PROXY", True)

CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "VELLUM_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if o.strip()
]

CAPABILITIES_CACHE_SECONDS = 30

CONSENT_HEADER = "X-Cloud-Consent"
CONSENT_VALUE = "granted"
