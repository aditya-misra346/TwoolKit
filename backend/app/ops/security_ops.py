"""Optional malware scanning with ClamAV (only when clamscan/clamdscan is installed)."""

from __future__ import annotations

import subprocess
from typing import Any

from .. import config
from ..capabilities import clamav_binary
from ..jobs import InputFile, JobContext, UserError


def clamav_scan(ctx: JobContext, inputs: list[InputFile], opts: dict[str, Any]) -> None:
    binary = clamav_binary()
    if not binary:
        raise UserError("ClamAV is not installed on the server, so no malware scan was performed.")
    results: list[dict[str, Any]] = []
    for i, inp in enumerate(inputs):
        ctx.check()
        ctx.progress(i / len(inputs), f"Scanning {inp.name}")
        try:
            proc = subprocess.run(
                [binary, "--no-summary", "--stdout", str(inp.path)],
                capture_output=True,
                text=True,
                timeout=config.CLAMAV_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            results.append({"name": inp.name, "status": "error", "detail": "Scan timed out"})
            continue
        line = (proc.stdout or "").strip().splitlines()[-1:] or [""]
        if proc.returncode == 0:
            results.append({"name": inp.name, "status": "clean"})
        elif proc.returncode == 1:
            sig = line[0].split(":", 1)[-1].replace("FOUND", "").strip()
            results.append({"name": inp.name, "status": "infected", "signature": sig})
        else:
            results.append({"name": inp.name, "status": "error", "detail": (proc.stderr or line[0])[:200]})
    with ctx.job.lock:
        ctx.job.scan = results
