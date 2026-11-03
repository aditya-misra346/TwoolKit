"""Vellum processing API (FastAPI).

Run:  backend/run.sh   (uvicorn on 127.0.0.1:8000)
"""

from __future__ import annotations

import asyncio
import json
import logging
import shutil
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.datastructures import UploadFile

from . import config
from .capabilities import capabilities_payload, get_engines, op_availability
from .jobs import InputFile, Job, JobManager, wipe_stale_job_dirs
from .ops import OPS
from .validation import detect_type, sanitize_filename

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("vellum.api")

manager = JobManager()


# ---------------------------------------------------------------------------
# lifecycle: retention cleanup loop
# ---------------------------------------------------------------------------


async def _cleanup_loop() -> None:
    while True:
        await asyncio.sleep(config.CLEANUP_INTERVAL_SECONDS)
        try:
            n = await asyncio.to_thread(manager.cleanup_expired)
            if n:
                log.info("retention: removed %d expired job dir(s)", n)
        except Exception:  # pragma: no cover
            log.exception("cleanup failed")


@asynccontextmanager
async def lifespan(_: FastAPI):
    wipe_stale_job_dirs()
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    # Warm capability detection (video codec probe) off the event loop.
    threading.Thread(target=get_engines, daemon=True).start()
    task = asyncio.create_task(_cleanup_loop())
    yield
    task.cancel()
    manager.shutdown()


app = FastAPI(title="TWOOLKIT Processing API", version=config.VERSION, lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", config.CONSENT_HEADER],
    max_age=600,
)


def _client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    if config.TRUST_LOOPBACK_PROXY and peer in ("127.0.0.1", "::1"):
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
    return peer


def _is_https(request: Request) -> bool:
    if request.url.scheme == "https":
        return True
    peer = request.client.host if request.client else ""
    return config.TRUST_LOOPBACK_PROXY and peer in ("127.0.0.1", "::1") and request.headers.get("x-forwarded-proto") == "https"


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    if not request.url.path.startswith("/api/docs"):
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; sandbox"
    if _is_https(request):
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ---------------------------------------------------------------------------
# rate limiting (token bucket per client IP, job creation only)
# ---------------------------------------------------------------------------


class TokenBucket:
    def __init__(self, capacity: int, window_s: int) -> None:
        self.capacity = capacity
        self.rate = capacity / window_s
        self._b: dict[str, tuple[float, float]] = {}
        self._lock = threading.Lock()

    def take(self, key: str) -> float:
        """Consume one token; return 0 if allowed, else seconds until next token."""
        now = time.monotonic()
        with self._lock:
            tokens, last = self._b.get(key, (float(self.capacity), now))
            tokens = min(self.capacity, tokens + (now - last) * self.rate)
            if tokens >= 1:
                self._b[key] = (tokens - 1, now)
                return 0.0
            self._b[key] = (tokens, now)
            return (1 - tokens) / self.rate


limiter = TokenBucket(config.RATE_LIMIT_CAPACITY, config.RATE_LIMIT_WINDOW_SECONDS)


# ---------------------------------------------------------------------------
# routes
# ---------------------------------------------------------------------------


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "version": config.VERSION}


@app.get("/api/capabilities")
def capabilities() -> dict[str, Any]:
    payload = capabilities_payload()
    payload["queue"] = {"pending": manager.queued_count(), "workers": config.WORKERS}
    return payload


def _get_job(job_id: str) -> Job:
    try:
        uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(404, "Job not found")
    job = manager.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found or already deleted (results are kept for a limited time).")
    return job


@app.post("/api/jobs", status_code=202)
async def create_job(request: Request):
    if request.headers.get(config.CONSENT_HEADER, "").lower() != config.CONSENT_VALUE:
        return JSONResponse(
            {"error": "Uploading files to the processing server requires your consent. Enable server processing in the app first."},
            status_code=428,
        )
    wait = limiter.take(_client_ip(request))
    if wait > 0:
        return JSONResponse(
            {"error": f"Too many jobs. Try again in {int(wait) + 1}s."},
            status_code=429,
            headers={"Retry-After": str(int(wait) + 1)},
        )
    if manager.queued_count() >= config.MAX_QUEUED_JOBS:
        return JSONResponse({"error": "The server is busy. Please retry shortly."}, status_code=503, headers={"Retry-After": "10"})
    try:
        clen = int(request.headers.get("content-length", "0"))
    except ValueError:
        clen = 0
    if clen > config.MAX_JOB_TOTAL_BYTES + 1024 * 1024:
        return JSONResponse({"error": f"Upload too large (max {config.MAX_JOB_TOTAL_MB} MB per job)."}, status_code=413)

    try:
        form = await request.form(max_files=config.MAX_FILES_PER_JOB, max_fields=10, max_part_size=64 * 1024)
    except Exception as exc:
        return JSONResponse({"error": f"Malformed upload: {exc}"}, status_code=400)

    job_dir: Path | None = None
    try:
        op = str(form.get("op") or "")
        spec = OPS.get(op)
        if not spec:
            return JSONResponse({"error": f"Unknown operation '{op}'."}, status_code=400)
        avail = op_availability(get_engines()).get(op, {"available": True})
        if not avail.get("available"):
            return JSONResponse({"error": f"This tool is unavailable on the server: {avail.get('reason')}"}, status_code=503)
        raw_opts = form.get("options") or "{}"
        try:
            options = json.loads(str(raw_opts))
            if not isinstance(options, dict):
                raise ValueError
        except ValueError:
            return JSONResponse({"error": "options must be a JSON object."}, status_code=400)

        uploads = [f for f in form.getlist("files") if isinstance(f, UploadFile)]
        if not uploads:
            return JSONResponse({"error": "No files were uploaded."}, status_code=400)
        if len(uploads) > config.MAX_FILES_PER_JOB:
            return JSONResponse({"error": f"Too many files (max {config.MAX_FILES_PER_JOB})."}, status_code=400)

        job_id, job_dir = manager.create_dir()
        in_dir = job_dir / "in"
        in_dir.mkdir(mode=0o700)
        inputs: list[InputFile] = []
        total = 0
        for i, up in enumerate(uploads):
            name = sanitize_filename(up.filename, fallback=f"file{i + 1}")
            dest = in_dir / f"{i:03d}.bin"
            size = 0
            with dest.open("wb") as fh:
                while chunk := await up.read(1024 * 1024):
                    size += len(chunk)
                    total += len(chunk)
                    if size > config.MAX_FILE_BYTES:
                        raise _Reject(413, f"'{name}' exceeds the {config.MAX_FILE_MB} MB per-file limit.")
                    if total > config.MAX_JOB_TOTAL_BYTES:
                        raise _Reject(413, f"Upload exceeds the {config.MAX_JOB_TOTAL_MB} MB per-job limit.")
                    fh.write(chunk)
            await up.close()
            if size == 0:
                raise _Reject(400, f"'{name}' is empty.")
            detected = detect_type(dest, name)
            if "*" not in spec.accepts and detected not in spec.accepts:
                raise _Reject(
                    415,
                    f"'{name}' was detected as {detected.upper()}, which this tool doesn't accept "
                    f"(expects {', '.join(sorted(t.upper() for t in spec.accepts if t != 'unknown'))}). "
                    "The file extension may not match its contents.",
                )
            inputs.append(InputFile(name=name, path=dest, size=size, detected_type=detected))

        job = Job(id=job_id, op=op, options=options, dir=job_dir, inputs=inputs)
        manager.submit(job, spec.handler, spec.batch_handler, spec.timeout_s)
        log.info("job %s %s files=%d bytes=%d", job_id, op, len(inputs), total)
        return {"id": job_id, "status": "queued"}
    except _Reject as r:
        if job_dir:
            shutil.rmtree(job_dir, ignore_errors=True)
        return JSONResponse({"error": r.message}, status_code=r.status)
    finally:
        await form.close()


class _Reject(Exception):
    def __init__(self, status: int, message: str) -> None:
        self.status, self.message = status, message


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str) -> dict[str, Any]:
    return _get_job(job_id).to_json()


@app.post("/api/jobs/{job_id}/cancel")
def cancel_job(job_id: str) -> dict[str, Any]:
    job = _get_job(job_id)
    manager.cancel(job)
    return {"status": job.status if job.status in ("completed", "failed") else "cancelled"}


@app.get("/api/jobs/{job_id}/outputs/{index}")
def download_output(job_id: str, index: int):
    job = _get_job(job_id)
    with job.lock:
        outs = list(job.outputs)
    if index < 0 or index >= len(outs):
        raise HTTPException(404, "Output not found")
    o = outs[index]
    if not o.path.exists():
        raise HTTPException(410, "This result has expired and was deleted from the server.")
    return FileResponse(o.path, media_type=o.mime, filename=o.name, headers={"Cache-Control": "no-store"})


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str) -> dict[str, Any]:
    job = _get_job(job_id)
    manager.delete(job)
    return {"deleted": True}
