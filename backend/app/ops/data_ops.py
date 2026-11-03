"""Python-native conversions between data and lightweight text formats.

Rich-text targets (pdf/docx) are produced from HTML via LibreOffice when
available, with PyMuPDF's HTML Story renderer / python-docx as fallbacks.
"""

from __future__ import annotations

import csv
import io
import json
import zipfile
from pathlib import Path
from typing import Any

from .. import libreoffice
from ..capabilities import find_soffice
from ..jobs import InputFile, JobContext, UserError
from ..validation import output_name
from .office_ops import validate_output

MATRIX: dict[str, list[str]] = {
    "csv": ["tsv", "json", "xlsx", "html", "md", "xml"],
    "tsv": ["csv", "json", "xlsx", "html", "md", "xml"],
    "json": ["csv", "tsv", "xlsx", "xml"],
    "xml": ["json"],
    "xlsx": ["csv", "tsv", "json"],
    "md": ["html", "pdf", "docx", "txt"],
    "html": ["md", "txt", "pdf", "docx"],
    "txt": ["pdf", "docx", "html", "md"],
}

MAX_TEXT_BYTES = 50 * 1024 * 1024


def _read_text(path: Path) -> str:
    raw = path.read_bytes()
    if len(raw) > MAX_TEXT_BYTES:
        raise UserError("Text files larger than 50 MB are not supported by this converter.")
    for enc in ("utf-8-sig", "utf-16") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


# ---------------------------------------------------------------------------
# tabular model: list of sheets → (name, header, rows)
# ---------------------------------------------------------------------------

Table = tuple[str, list[str], list[list[Any]]]


def _read_delimited(path: Path, delim: str) -> list[Table]:
    text = _read_text(path)
    rows = list(csv.reader(io.StringIO(text), delimiter=delim))
    rows = [r for r in rows if any(c.strip() for c in r)]
    if not rows:
        raise UserError("The file contains no rows.")
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    return [("Sheet1", rows[0], rows[1:])]


def _read_xlsx(path: Path) -> list[Table]:
    from openpyxl import load_workbook

    # openpyxl checks the filename extension; uploads are stored as .bin, so pass a handle.
    with path.open("rb") as fh:
        wb = load_workbook(io.BytesIO(fh.read()), read_only=True, data_only=True)
    tables: list[Table] = []
    for ws in wb.worksheets:
        rows = [["" if v is None else v for v in row] for row in ws.iter_rows(values_only=True)]
        rows = [r for r in rows if any(str(c).strip() for c in r)]
        if not rows:
            continue
        width = max(len(r) for r in rows)
        rows = [list(r) + [""] * (width - len(r)) for r in rows]
        tables.append((ws.title, [str(h) for h in rows[0]], rows[1:]))
    wb.close()
    if not tables:
        raise UserError("The workbook has no data.")
    return tables


def _scalar(v: Any) -> Any:
    return json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v


def _read_json(path: Path) -> list[Table]:
    try:
        data = json.loads(_read_text(path))
    except json.JSONDecodeError as exc:
        raise UserError(f"Invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}.") from exc
    if isinstance(data, dict):
        # {"a": [...], "b": [...]} → one sheet per list; else single-row object
        lists = {k: v for k, v in data.items() if isinstance(v, list)}
        if lists and len(lists) == len(data):
            out = []
            for k, v in lists.items():
                out.extend(_records_to_table(str(k), v))
            return out
        data = [data]
    if not isinstance(data, list):
        raise UserError("JSON must be an array (of objects or arrays) or an object.")
    return _records_to_table("Sheet1", data)


def _records_to_table(name: str, data: list[Any]) -> list[Table]:
    if not data:
        return [(name, [], [])]
    if all(isinstance(r, dict) for r in data):
        header: list[str] = []
        for r in data:
            for k in r:
                if k not in header:
                    header.append(str(k))
        rows = [[_scalar(r.get(h, "")) for h in header] for r in data]
        return [(name, header, rows)]
    if all(isinstance(r, list) for r in data):
        width = max(len(r) for r in data)
        rows = [[_scalar(c) for c in r] + [""] * (width - len(r)) for r in data]
        return [(name, [str(c) for c in rows[0]], rows[1:])]
    return [(name, ["value"], [[_scalar(v)] for v in data])]


def _write_delimited(t: Table, delim: str) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=delim, lineterminator="\n")
    w.writerow(t[1])
    w.writerows(t[2])
    return buf.getvalue()


def _table_records(t: Table) -> list[dict[str, Any]]:
    header = [h or f"column_{i + 1}" for i, h in enumerate(t[1])]
    return [dict(zip(header, r)) for r in t[2]]


def _html_table(t: Table) -> str:
    import html as h

    head = "".join(f"<th>{h.escape(str(c))}</th>" for c in t[1])
    body = "".join("<tr>" + "".join(f"<td>{h.escape(str(c))}</td>" for c in r) + "</tr>" for r in t[2])
    return f"<h2>{h.escape(t[0])}</h2><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def _md_table(t: Table) -> str:
    esc = lambda c: str(c).replace("|", "\\|").replace("\n", " ")  # noqa: E731
    lines = ["| " + " | ".join(esc(c) for c in t[1]) + " |", "| " + " | ".join("---" for _ in t[1]) + " |"]
    lines += ["| " + " | ".join(esc(c) for c in r) + " |" for r in t[2]]
    return "\n".join(lines)


def _xml_from_tables(tables: list[Table]) -> str:
    from xml.sax.saxutils import escape

    def tag(s: str) -> str:
        import re

        s = re.sub(r"[^A-Za-z0-9_.-]", "_", s or "field")
        return s if re.match(r"[A-Za-z_]", s) else f"_{s}"

    out = ['<?xml version="1.0" encoding="UTF-8"?>', "<data>"]
    for t in tables:
        out.append(f'  <sheet name="{escape(t[0])}">')
        for rec in _table_records(t):
            out.append("    <row>" + "".join(f"<{tag(k)}>{escape(str(v))}</{tag(k)}>" for k, v in rec.items()) + "</row>")
        out.append("  </sheet>")
    out.append("</data>")
    return "\n".join(out)


# ---------------------------------------------------------------------------
# rich text
# ---------------------------------------------------------------------------

_HTML_CSS = (
    "body{font-family:Helvetica,Arial,sans-serif;font-size:11pt;line-height:1.5;color:#111}"
    "table{border-collapse:collapse;margin:8px 0}td,th{border:1px solid #999;padding:4px 6px}"
    "th{background:#eee}pre,code{font-family:Courier,monospace;background:#f4f4f4}"
)


def _wrap_html(body: str, title: str) -> str:
    import html as h

    return f"<!DOCTYPE html><html><head><meta charset='utf-8'><title>{h.escape(title)}</title><style>{_HTML_CSS}</style></head><body>{body}</body></html>"


def _md_to_html(md_text: str) -> str:
    import markdown

    return markdown.markdown(md_text, extensions=["tables", "fenced_code", "sane_lists", "toc"])


def _html_to_rich(ctx: JobContext, html_doc: str, target: str, work: Path) -> Path:
    src = work / "doc.html"
    src.write_text(html_doc, encoding="utf-8")
    if find_soffice():
        produced = libreoffice.convert(ctx, src, "html", target, work / "lo")
        return produced[0]
    if target == "pdf":
        import pymupdf

        ctx.progress(None, "Rendering PDF (built-in HTML renderer)")
        out = work / "out.pdf"
        story = pymupdf.Story(html=html_doc)
        writer = pymupdf.DocumentWriter(str(out))
        mediabox = pymupdf.paper_rect("a4")
        where = mediabox + (54, 54, -54, -54)
        more = True
        while more:
            dev = writer.begin_page(mediabox)
            more, _ = story.place(where)
            story.draw(dev)
            writer.end_page()
        writer.close()
        ctx.warn("LibreOffice is unavailable, so a simpler built-in renderer was used.")
        return out
    raise UserError("DOCX output requires LibreOffice, which is not installed on the server.")


def _html_to_text(html_doc: str) -> str:
    from html.parser import HTMLParser

    class P(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self.out: list[str] = []
            self.skip = 0

        def handle_starttag(self, tag, attrs):  # noqa: ANN001
            if tag in ("script", "style"):
                self.skip += 1
            if tag in ("p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6"):
                self.out.append("\n")

        def handle_endtag(self, tag):  # noqa: ANN001
            if tag in ("script", "style"):
                self.skip = max(0, self.skip - 1)

        def handle_data(self, data):  # noqa: ANN001
            if not self.skip:
                self.out.append(data)

    p = P()
    p.feed(html_doc)
    import re

    return re.sub(r"\n{3,}", "\n\n", "".join(p.out)).strip() + "\n"


# ---------------------------------------------------------------------------
# entry point
# ---------------------------------------------------------------------------


def convert(ctx: JobContext, inp: InputFile, opts: dict[str, Any]) -> None:
    src = inp.detected_type
    target = str(opts.get("target", "")).lower()
    if src not in MATRIX:
        raise UserError(f"{src.upper()} isn't supported by the data converter.")
    if target not in MATRIX[src]:
        raise UserError(f"Can't convert {src.upper()} to {target.upper() or '?'}. Supported: {', '.join(t.upper() for t in MATRIX[src])}.")
    work = ctx.new_work_dir("data")
    stem = Path(inp.name).stem
    ctx.progress(None, f"Converting {src.upper()} → {target.upper()}")

    def emit_text(text: str, ext: str, note: str | None = None) -> None:
        p = work / f"out.{ext}"
        p.write_text(text, encoding="utf-8")
        ctx.add_output(p, output_name(inp.name, ext), note=note)

    # ---- tabular sources
    if src in ("csv", "tsv", "json", "xlsx"):
        tables = (
            _read_delimited(inp.path, "," if src == "csv" else "\t")
            if src in ("csv", "tsv")
            else _read_json(inp.path)
            if src == "json"
            else _read_xlsx(inp.path)
        )
        if target in ("csv", "tsv"):
            delim = "," if target == "csv" else "\t"
            if len(tables) == 1:
                emit_text(_write_delimited(tables[0], delim), target)
            else:
                z = work / "out.zip"
                with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
                    for t in tables:
                        zf.writestr(f"{stem}-{t[0]}.{target}", _write_delimited(t, delim))
                ctx.add_output(z, output_name(inp.name, "zip", f"-{target}"), note=f"{len(tables)} sheets")
            if src == "xlsx":
                ctx.warn("Formulas are exported as their last calculated values; formatting is not kept.")
        elif target == "json":
            data: Any = _table_records(tables[0]) if len(tables) == 1 else {t[0]: _table_records(t) for t in tables}
            emit_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), "json")
        elif target == "xlsx":
            from openpyxl import Workbook
            from openpyxl.styles import Font

            wb = Workbook()
            wb.remove(wb.active)
            for t in tables:
                ws = wb.create_sheet(t[0][:31] or "Sheet")
                ws.append(t[1])
                for c in ws[1]:
                    c.font = Font(bold=True)
                for r in t[2]:
                    ws.append([_coerce(v) for v in r])
            p = work / "out.xlsx"
            wb.save(p)
            validate_output(p, "xlsx")
            ctx.add_output(p, output_name(inp.name, "xlsx"))
        elif target == "html":
            emit_text(_wrap_html("".join(_html_table(t) for t in tables), stem), "html")
        elif target == "md":
            emit_text("\n\n".join(f"## {t[0]}\n\n{_md_table(t)}" for t in tables) + "\n", "md")
        elif target == "xml":
            emit_text(_xml_from_tables(tables), "xml")
        return

    if src == "xml":
        import xmltodict

        try:
            data = xmltodict.parse(_read_text(inp.path), disable_entities=True)
        except Exception as exc:
            raise UserError(f"Invalid XML: {exc}") from exc
        emit_text(json.dumps(data, ensure_ascii=False, indent=2), "json")
        return

    # ---- text-like sources
    text = _read_text(inp.path)
    if src == "md":
        body = _md_to_html(text)
    elif src == "html":
        body = text
    else:  # txt
        import html as h

        body = "".join(f"<p>{h.escape(p).replace(chr(10), '<br>')}</p>" for p in text.split("\n\n"))

    if target == "html":
        emit_text(body if src == "html" else _wrap_html(body, stem), "html")
    elif target == "md":
        from markdownify import markdownify

        emit_text(markdownify(body, heading_style="ATX"), "md")
    elif target == "txt":
        emit_text(_html_to_text(body), "txt")
    elif target in ("pdf", "docx"):
        html_doc = body if src == "html" and "<html" in body.lower() else _wrap_html(body, stem)
        out = _html_to_rich(ctx, html_doc, target, work)
        validate_output(out, target)
        ctx.add_output(out, output_name(inp.name, target))


def _coerce(v: Any) -> Any:
    if isinstance(v, str):
        s = v.strip()
        try:
            if s.isdigit() and len(s) < 16 and not (len(s) > 1 and s.startswith("0")):
                return int(s)
            if s.count(".") == 1 and s.replace(".", "", 1).lstrip("-").isdigit():
                return float(s)
        except ValueError:
            pass
    return v
