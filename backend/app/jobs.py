"""In-memory job manager with a bounded worker pool and cooperative cancellation."""

from __future__ import annotations

import itertools
import logging
import shutil
import threading
import time
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from . import config
from .validation import mime_for, sanitize_filename

log = logging.getLogger("vellum.jobs")


class UserError(Exception):
    """An error whose message is safe and actionable for the end user."""


class JobCancelled(Exception):
    pass


class JobTimeout(Exception):
    pass


@dataclass
class InputFile:
    name: str  # sanitized original name
    path: Path  # on-disk location
    size: int
    detected_type: str

    def to_json(self) -> dict[str, Any]:
        return {"name": self.name, "size": self.size, "detectedType": self.detected_type}


@dataclass
class OutputFile:
    index: int
    name: str
    path: Path
    size: int
    mime: str
    note: str | None = None

    def to_json(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "name": self.name,
            "size": self.size,
            "mime": self.mime,
            "note": self.note,
        }


@dataclass
class Job:
    id: str
    op: str
    options: dict[str, Any]
    dir: Path
    inputs: list[InputFile]
    status: str = "queued"
    progress: float | None = 0.0
    stage: str = "Queued"
    created_at: float = field(default_factory=time.time)
    started_at: float | None = None
    finished_at: float | None = None
    outputs: list[OutputFile] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    error: str | None = None
    scan: list[dict[str, Any]] | None = None
    cancel_event: threading.Event = field(default_factory=threading.Event)
    lock: threading.Lock = field(default_factory=threading.Lock)

    @property
    def expires_at(self) -> float | None:
        if self.finished_at is None:
            return None
        return self.finished_at + config.RETENTION_MINUTES * 60

    def to_json(self) -> dict[str, Any]:
        with self.lock:
            return {
                "id": self.id,
                "op": self.op,
                "status": self.status,
                "progress": None if self.progress is None else round(self.progress, 4),
                "stage": self.stage,
                "createdAt": self.created_at,
                "startedAt": self.started_at,
                "finishedAt": self.finished_at,
                "inputs": [i.to_json() for i in self.inputs],
                "outputs": [o.to_json() for o in self.outputs],
                "warnings": list(self.warnings),
                "error": self.error,
                "scan": self.scan,
                "expiresAt": self.expires_at,
            }


_worker_ids = itertools.count(1)
_thread_local = threading.local()


def _init_worker() -> None:
    _thread_local.worker_id = next(_worker_ids)


def current_worker_id() -> int:
    return getattr(_thread_local, "worker_id", 0)


class JobContext:
    """Handle passed to op implementations for progress, cancellation and outputs.

    Progress reported by an op is per input file (0..1); the context maps it onto
    the whole job's progress across all inputs.
    """

    def __init__(self, job: Job, timeout_s: float) -> None:
        self.job = job
        self.deadline = time.monotonic() + timeout_s
        self._file_index = 0
        self._file_count = max(1, len(job.inputs))
        self.out_dir = job.dir / "out"
        self.out_dir.mkdir(mode=0o700, exist_ok=True)
        self.work_dir = job.dir / "work"
        self.work_dir.mkdir(mode=0o700, exist_ok=True)

    # -- cancellation ---------------------------------------------------------
    @property
    def cancel_event(self) -> threading.Event:
        return self.job.cancel_event

    def check(self) -> None:
        """Raise if the job was cancelled or exceeded its time budget."""
        if self.job.cancel_event.is_set():
            raise JobCancelled()
        if time.monotonic() > self.deadline:
            raise JobTimeout()

    def remaining_time(self) -> float:
        return max(1.0, self.deadline - time.monotonic())

    # -- progress -------------------------------------------------------------
    def set_file_index(self, i: int) -> None:
        self._file_index = i

    def progress(self, fraction: float | None, stage: str | None = None) -> None:
        """Report real progress for the current input (fraction of work units) or None."""
        with self.job.lock:
            if fraction is None:
                self.job.progress = None
            else:
                f = min(max(fraction, 0.0), 1.0)
                self.job.progress = (self._file_index + f) / self._file_count
            if stage:
                prefix = (
                    f"[{self._file_index + 1}/{self._file_count}] "
                    if self._file_count > 1
                    else ""
                )
                self.job.stage = prefix + stage

    def stage(self, text: str) -> None:
        """Update stage text without touching progress."""
        with self.job.lock:
            prefix = (
                f"[{self._file_index + 1}/{self._file_count}] " if self._file_count > 1 else ""
            )
            self.job.stage = prefix + text

    def warn(self, message: str) -> None:
        with self.job.lock:
            if message not in self.job.warnings:
                self.job.warnings.append(message)

    # -- outputs --------------------------------------------------------------
    def new_work_dir(self, label: str) -> Path:
        d = self.work_dir / f"{label}_{uuid.uuid4().hex[:8]}"
        d.mkdir(mode=0o700, parents=True)
        return d

    def add_output(
        self, src: Path, name: str, ext: str | None = None, note: str | None = None
    ) -> OutputFile:
        """Move a validated file into the job's output dir and register it."""
        name = sanitize_filename(name, fallback="output")
        with self.job.lock:
            existing = {o.name for o in self.job.outputs}
            base, dot, suffix = name.rpartition(".")
            if not dot:
                base, suffix = name, ""
            candidate, n = name, 2
            while candidate in existing:
                candidate = f"{base} ({n}).{suffix}" if suffix else f"{base} ({n})"
                n += 1
            index = len(self.job.outputs)
            dest = self.out_dir / f"{index:03d}_{uuid.uuid4().hex[:6]}"
            shutil.move(str(src), dest)
            out = OutputFile(
                index=index,
                name=candidate,
                path=dest,
                size=dest.stat().st_size,
                mime=mime_for(ext or suffix),
                note=note,
            )
            self.job.outputs.append(out)
            return out


OpHandler = Callable[[JobContext, InputFile, dict[str, Any]], None]
BatchHandler = Callable[[JobContext, list[InputFile], dict[str, Any]], None]


class JobManager:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(
            max_workers=config.WORKERS,
            thread_name_prefix="vellum-worker",
            initializer=_init_worker,
        )
        self._pending = 0

    # -- registry -------------------------------------------------------------
    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def queued_count(self) -> int:
        with self._lock:
            return self._pending

    def create_dir(self) -> tuple[str, Path]:
        job_id = str(uuid.uuid4())
        d = config.JOBS_DIR / job_id
        d.mkdir(mode=0o700, parents=True)
        d.chmod(0o700)
        return job_id, d

    def submit(
        self,
        job: Job,
        handler: OpHandler | None,
        batch_handler: BatchHandler | None,
        timeout_s: float,
    ) -> None:
        with self._lock:
            self._jobs[job.id] = job
            self._pending += 1
        self._executor.submit(self._run, job, handler, batch_handler, timeout_s)

    def cancel(self, job: Job) -> None:
        job.cancel_event.set()
        with job.lock:
            if job.status == "queued":
                job.status = "cancelled"
                job.stage = "Cancelled"
                job.finished_at = time.time()

    def delete(self, job: Job) -> None:
        job.cancel_event.set()
        with self._lock:
            self._jobs.pop(job.id, None)
        shutil.rmtree(job.dir, ignore_errors=True)

    # -- execution ------------------------------------------------------------
    def _finish(self, job: Job, status: str, stage: str, error: str | None = None) -> None:
        with job.lock:
            job.status = status
            job.stage = stage
            job.error = error
            job.finished_at = time.time()
            if status == "completed":
                job.progress = 1.0

    def _run(
        self,
        job: Job,
        handler: OpHandler | None,
        batch_handler: BatchHandler | None,
        timeout_s: float,
    ) -> None:
        with self._lock:
            self._pending -= 1
        if job.cancel_event.is_set():
            return  # cancelled while queued; already marked
        with job.lock:
            job.status = "running"
            job.started_at = time.time()
            job.stage = "Starting"
            job.progress = 0.0
        ctx = JobContext(job, timeout_s)
        try:
            if batch_handler is not None:
                batch_handler(ctx, job.inputs, job.options)
            else:
                assert handler is not None
                self._run_per_file(ctx, job, handler)
            ctx.check()
            if job.cancel_event.is_set():
                raise JobCancelled()
            self._finish(job, "completed", "Done")
        except JobCancelled:
            self._finish(job, "cancelled", "Cancelled")
            self._purge_outputs(job)
        except JobTimeout:
            self._finish(
                job,
                "failed",
                "Timed out",
                "Processing took too long and was stopped. Try a smaller file or fewer pages.",
            )
            self._purge_outputs(job)
        except UserError as exc:
            self._finish(job, "failed", "Failed", str(exc))
            self._purge_outputs(job)
        except Exception as exc:  # unexpected: log details, keep message generic-but-useful
            log.error("job %s (%s) crashed: %s\n%s", job.id, job.op, exc, traceback.format_exc())
            self._finish(
                job,
                "failed",
                "Failed",
                f"Unexpected error while processing: {type(exc).__name__}: {exc}"[:500],
            )
            self._purge_outputs(job)
        finally:
            shutil.rmtree(job.dir / "work", ignore_errors=True)

    def _run_per_file(self, ctx: JobContext, job: Job, handler: OpHandler) -> None:
        errors: list[str] = []
        for i, inp in enumerate(job.inputs):
            ctx.check()
            ctx.set_file_index(i)
            ctx.progress(0.0, f"Processing {inp.name}")
            try:
                handler(ctx, inp, job.options)
            except (JobCancelled, JobTimeout):
                raise
            except UserError as exc:
                if len(job.inputs) == 1:
                    raise
                errors.append(f"{inp.name}: {exc}")
                ctx.warn(f"{inp.name} failed: {exc}")
            except Exception as exc:
                if len(job.inputs) == 1:
                    raise
                log.error("job %s file %s crashed\n%s", job.id, inp.name, traceback.format_exc())
                errors.append(f"{inp.name}: {type(exc).__name__}: {exc}")
                ctx.warn(f"{inp.name} failed: {type(exc).__name__}: {exc}")
        if errors and len(errors) == len(job.inputs):
            raise UserError("All files failed. " + " | ".join(errors)[:800])

    @staticmethod
    def _purge_outputs(job: Job) -> None:
        with job.lock:
            for o in job.outputs:
                o.path.unlink(missing_ok=True)
            job.outputs = []

    # -- retention ------------------------------------------------------------
    def cleanup_expired(self) -> int:
        now = time.time()
        removed = 0
        with self._lock:
            expired = [
                j for j in self._jobs.values() if j.expires_at is not None and j.expires_at <= now
            ]
            for j in expired:
                self._jobs.pop(j.id, None)
            known = set(self._jobs)
        for j in expired:
            shutil.rmtree(j.dir, ignore_errors=True)
            removed += 1
        # Orphan dirs (e.g. aborted uploads) older than the retention window.
        if config.JOBS_DIR.exists():
            for d in config.JOBS_DIR.iterdir():
                if d.name in known:
                    continue
                try:
                    age = now - d.stat().st_mtime
                except FileNotFoundError:
                    continue
                if age > config.RETENTION_MINUTES * 60:
                    shutil.rmtree(d, ignore_errors=True)
                    removed += 1
        return removed

    def shutdown(self) -> None:
        with self._lock:
            jobs = list(self._jobs.values())
        for j in jobs:
            j.cancel_event.set()
        self._executor.shutdown(wait=False, cancel_futures=True)


def wipe_stale_job_dirs() -> None:
    """On startup nothing in memory references old dirs: remove them all."""
    if config.JOBS_DIR.exists():
        for d in config.JOBS_DIR.iterdir():
            shutil.rmtree(d, ignore_errors=True) if d.is_dir() else d.unlink(missing_ok=True)
    config.JOBS_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
