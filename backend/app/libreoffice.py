"""LibreOffice headless runner with per-worker isolated profiles and cancellation."""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import time
from pathlib import Path

from . import config
from .capabilities import find_soffice
from .jobs import JobCancelled, JobContext, UserError, current_worker_id

# Explicit export filters: target ext -> filter per document family.
EXPORT_FILTERS: dict[str, dict[str, str]] = {
    "text": {
        "pdf": "pdf:writer_pdf_Export",
        "docx": "docx:MS Word 2007 XML",
        "doc": "doc:MS Word 97",
        "odt": "odt:writer8",
        "rtf": "rtf:Rich Text Format",
        "txt": "txt:Text (encoded):UTF8",
        "html": "html:XHTML Writer File:UTF8",
    },
    "sheet": {
        "pdf": "pdf:calc_pdf_Export",
        "xlsx": "xlsx:Calc MS Excel 2007 XML",
        "xls": "xls:MS Excel 97",
        "ods": "ods:calc8",
        # 44=',' 34='"' 76=UTF-8, 1=first line, ''=col formats, 0=lang,
        # false/true/false/false/false = quoted-as-text/detect-special/..., -1 = all sheets
        "csv": "csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1",
        "html": "html:HTML (StarCalc)",
    },
    "slides": {
        "pdf": "pdf:impress_pdf_Export",
        "pptx": "pptx:Impress MS PowerPoint 2007 XML",
        "ppt": "ppt:MS PowerPoint 97",
        "odp": "odp:impress8",
    },
}

FAMILY_OF: dict[str, str] = {
    "doc": "text",
    "docx": "text",
    "odt": "text",
    "rtf": "text",
    "txt": "text",
    "html": "text",
    "md": "text",
    "xls": "sheet",
    "xlsx": "sheet",
    "ods": "sheet",
    "csv": "sheet",
    "tsv": "sheet",
    "ppt": "slides",
    "pptx": "slides",
    "odp": "slides",
}

# Import filters for inputs LibreOffice might otherwise open in the wrong module.
IMPORT_FILTERS: dict[str, str] = {
    "csv": "CSV:44,34,76,1",
    "tsv": "CSV:9,34,76,1",
    "html": "HTML (StarWriter)",  # open in Writer (not Writer/Web) so all exports work
    "txt": "Text (encoded):UTF8",
}


def _kill_tree(proc: subprocess.Popen[bytes]) -> None:
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        try:
            proc.kill()
        except ProcessLookupError:
            pass
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass


def convert(
    ctx: JobContext,
    src: Path,
    src_type: str,
    target: str,
    out_dir: Path,
    family: str | None = None,
) -> list[Path]:
    """Convert ``src`` with LibreOffice, returning the produced files in ``out_dir``.

    The source is copied to a neutral ASCII filename to avoid quoting issues.
    Honors job cancellation (the soffice process group is killed) and the
    LibreOffice timeout.
    """
    soffice = find_soffice()
    if not soffice:
        raise UserError(
            "LibreOffice is not installed on the server, so this conversion is unavailable."
        )
    family = family or FAMILY_OF.get(src_type)
    if family is None or target not in EXPORT_FILTERS[family]:
        raise UserError(f"LibreOffice cannot convert {src_type} to {target}.")
    filt = EXPORT_FILTERS[family][target]

    in_dir = ctx.new_work_dir("lo_in")
    ext = {"md": "txt"}.get(src_type, src_type)
    staged = in_dir / f"input.{ext}"
    shutil.copyfile(src, staged)
    out_dir.mkdir(parents=True, exist_ok=True)

    profile = config.LO_PROFILE_DIR / f"lo_profile_{current_worker_id()}"
    profile.mkdir(parents=True, exist_ok=True)
    cmd = [
        soffice,
        f"-env:UserInstallation={profile.as_uri()}",
        "--headless",
        "--invisible",
        "--norestore",
        "--nologo",
        "--nodefault",
        "--nolockcheck",
    ]
    infilter = IMPORT_FILTERS.get(src_type)
    if infilter:
        cmd.append(f"--infilter={infilter}")
    cmd += ["--convert-to", filt, "--outdir", str(out_dir), str(staged)]

    env = dict(os.environ)
    env.setdefault("HOME", str(Path.home()))
    env["SAL_USE_VCLPLUGIN"] = env.get("SAL_USE_VCLPLUGIN", "svp")

    ctx.progress(None, f"Converting with LibreOffice → {target.upper()}")
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        start_new_session=True,  # own process group so we can kill helpers too
        env=env,
    )
    deadline = time.monotonic() + min(config.LIBREOFFICE_TIMEOUT_SECONDS, ctx.remaining_time())
    try:
        while True:
            try:
                proc.wait(timeout=0.25)
                break
            except subprocess.TimeoutExpired:
                pass
            if ctx.cancel_event.is_set():
                _kill_tree(proc)
                raise JobCancelled()
            if time.monotonic() > deadline:
                _kill_tree(proc)
                raise UserError(
                    f"LibreOffice took longer than {config.LIBREOFFICE_TIMEOUT_SECONDS}s and was "
                    "stopped. The document may be too large or complex."
                )
    finally:
        if proc.poll() is None:
            _kill_tree(proc)
    output = (proc.stdout.read() if proc.stdout else b"").decode("utf-8", "replace")
    produced = sorted(p for p in out_dir.iterdir() if p.is_file())
    if not produced:
        detail = output.strip().splitlines()[-1] if output.strip() else f"exit code {proc.returncode}"
        raise UserError(
            f"LibreOffice could not convert this file to {target.upper()} ({detail[:200]}). "
            "The file may be corrupted or use unsupported features."
        )
    return produced
