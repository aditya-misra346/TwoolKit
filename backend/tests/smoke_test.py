"""End-to-end smoke test: generates sample inputs and exercises every op over HTTP.

Usage: backend/.venv/bin/python backend/tests/smoke_test.py [base_url]
Each output is downloaded and opened with the relevant library.
"""

from __future__ import annotations

import io
import json
import sys
import time
import zipfile
from pathlib import Path

import httpx
import pymupdf
from PIL import Image

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
H = {"X-Cloud-Consent": "granted"}
OUT = Path(__file__).parent / "_out"
OUT.mkdir(exist_ok=True)
client = httpx.Client(base_url=BASE, timeout=300)
results: list[tuple[str, str, str]] = []


# ---------------------------------------------------------------- samples
def sample_pdf() -> bytes:
    doc = pymupdf.open()
    for n in range(3):
        page = doc.new_page()
        page.insert_text((72, 80), f"Quarterly report — page {n + 1}", fontsize=20)
        page.insert_text((72, 110), "Revenue grew strongly across all regions this quarter.", fontsize=11)
        # a ruled table
        x0, y0, cw, rh = 72, 150, 120, 22
        data = [["Region", "Q1", "Q2"], ["North", "120", "140"], ["South", "98", "110"], ["West", "75", "90"]]
        for r, row in enumerate(data):
            for c, val in enumerate(row):
                rect = pymupdf.Rect(x0 + c * cw, y0 + r * rh, x0 + (c + 1) * cw, y0 + (r + 1) * rh)
                page.draw_rect(rect, color=(0, 0, 0), width=0.7)
                page.insert_text((rect.x0 + 4, rect.y1 - 6), val, fontsize=10)
        img = Image.new("RGB", (200, 120), (30, 120, 220))
        b = io.BytesIO()
        img.save(b, "PNG")
        page.insert_image(pymupdf.Rect(72, 300, 272, 420), stream=b.getvalue())
    return doc.tobytes()


def sample_docx() -> bytes:
    import docx

    d = docx.Document()
    d.add_heading("Project brief", 1)
    d.add_paragraph("This document describes the plan.")
    t = d.add_table(rows=2, cols=2)
    t.cell(0, 0).text, t.cell(0, 1).text = "A", "B"
    b = io.BytesIO()
    d.save(b)
    return b.getvalue()


def sample_pptx() -> bytes:
    from pptx import Presentation

    p = Presentation()
    for i in range(2):
        s = p.slides.add_slide(p.slide_layouts[1])
        s.shapes.title.text = f"Slide {i + 1}"
        s.placeholders[1].text = "Bullet point"
    b = io.BytesIO()
    p.save(b)
    return b.getvalue()


def sample_xlsx() -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(["name", "qty"])
    ws.append(["apple", 3])
    ws2 = wb.create_sheet("Other")
    ws2.append(["x", "y"])
    ws2.append([1, 2])
    b = io.BytesIO()
    wb.save(b)
    return b.getvalue()


def img_bytes(fmt: str, alpha: bool = False) -> bytes:
    img = Image.new("RGBA" if alpha else "RGB", (64, 48), (200, 60, 60, 128) if alpha else (200, 60, 60))
    b = io.BytesIO()
    img.save(b, fmt)
    return b.getvalue()


def heic_bytes() -> bytes | None:
    try:
        import pillow_heif

        pillow_heif.register_heif_opener()
        b = io.BytesIO()
        Image.new("RGB", (64, 48), (10, 160, 90)).save(b, "HEIF")
        return b.getvalue()
    except Exception:
        return None


def encrypted_pdf() -> bytes:
    doc = pymupdf.open(stream=sample_pdf(), filetype="pdf")
    return doc.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw="secret", owner_pw="secret")


# ---------------------------------------------------------------- runner
def run(label: str, op: str, files: list[tuple[str, bytes]], options: dict | None = None, expect: str = "completed", check=None):
    try:
        r = client.post(
            "/api/jobs",
            headers=H,
            data={"op": op, "options": json.dumps(options or {})},
            files=[("files", (n, b)) for n, b in files],
        )
        if expect.startswith("http"):
            code = int(expect[4:])
            ok = r.status_code == code
            results.append((label, "PASS" if ok else "FAIL", f"HTTP {r.status_code} {r.json().get('error', '')[:90]}"))
            return
        if r.status_code != 202:
            results.append((label, "FAIL", f"HTTP {r.status_code}: {r.text[:160]}"))
            return
        jid = r.json()["id"]
        while True:
            j = client.get(f"/api/jobs/{jid}").json()
            if j["status"] in ("completed", "failed", "cancelled"):
                break
            time.sleep(0.3)
        if j["status"] != expect:
            results.append((label, "FAIL", f"status={j['status']} err={j.get('error')}"))
            return
        if expect != "completed":
            results.append((label, "PASS", f"{j['status']}: {(j.get('error') or '')[:90]}"))
            return
        detail = []
        for o in j["outputs"]:
            data = client.get(f"/api/jobs/{jid}/outputs/{o['index']}").content
            p = OUT / o["name"]
            p.write_bytes(data)
            if check:
                check(p)
            detail.append(f"{o['name']} ({len(data)}B){' · ' + o['note'] if o.get('note') else ''}")
        client.delete(f"/api/jobs/{jid}")
        results.append((label, "PASS", "; ".join(detail)[:160]))
    except Exception as exc:
        results.append((label, "FAIL", f"{type(exc).__name__}: {exc}"[:200]))


def chk_pdf(p: Path):
    with pymupdf.open(p) as d:
        assert d.page_count > 0


def chk_zip(p: Path):
    with zipfile.ZipFile(p) as z:
        assert z.testzip() is None and z.namelist()


def chk_img(p: Path):
    with Image.open(p) as im:
        im.verify()


def chk_docx(p: Path):
    import docx

    docx.Document(str(p))


def chk_pptx(p: Path):
    from pptx import Presentation

    assert len(Presentation(str(p)).slides) > 0


def chk_xlsx(p: Path):
    from openpyxl import load_workbook

    load_workbook(p)


def chk_text(p: Path):
    assert p.read_text(encoding="utf-8").strip()


def main() -> None:
    caps = client.get("/api/capabilities").json()
    lo = caps["engines"]["libreoffice"]["available"]
    print("LibreOffice:", lo, caps["engines"]["libreoffice"].get("version"), "| video:", caps["engines"]["video"])
    pdf = sample_pdf()
    run("pdf.to_docx", "pdf.to_docx", [("r.pdf", pdf)], check=chk_docx)
    run("pdf.to_pptx hybrid", "pdf.to_pptx", [("r.pdf", pdf)], {"mode": "hybrid"}, check=chk_pptx)
    run("pdf.to_pptx image", "pdf.to_pptx", [("r.pdf", pdf)], {"mode": "image"}, check=chk_pptx)
    run("pdf.to_xlsx", "pdf.to_xlsx", [("r.pdf", pdf)], check=chk_xlsx)
    run("pdf.to_html", "pdf.to_html", [("r.pdf", pdf)], check=chk_text)
    run("pdf.to_svg", "pdf.to_svg", [("r.pdf", pdf)], check=chk_zip)
    run("pdf.to_svg single", "pdf.to_svg", [("r.pdf", pdf)], {"pages": "2"}, check=chk_text)
    run("pdf.to_txt", "pdf.to_txt", [("r.pdf", pdf)], check=chk_text)
    for lvl in ("low", "balanced", "max"):
        run(f"pdf.compress {lvl}", "pdf.compress", [("r.pdf", pdf)], {"level": lvl}, check=chk_pdf)
    run("pdf.protect", "pdf.protect", [("r.pdf", pdf)], {"userPassword": "pw123"})
    enc = encrypted_pdf()
    run("pdf.unlock ok", "pdf.unlock", [("e.pdf", enc)], {"password": "secret"}, check=chk_pdf)
    run("pdf.unlock wrong pw", "pdf.unlock", [("e.pdf", enc)], {"password": "nope"}, expect="failed")
    run("pdf.to_docx encrypted no pw", "pdf.to_docx", [("e.pdf", enc)], expect="failed")
    corrupted = pdf[: len(pdf) // 2]
    run("pdf.repair truncated", "pdf.repair", [("broken.pdf", corrupted)], check=chk_pdf)
    run("pdf.extract_images", "pdf.extract_images", [("r.pdf", pdf)], check=chk_zip)
    run("reject wrong type", "pdf.to_docx", [("fake.pdf", img_bytes("PNG"))], expect="http415")
    r = client.post("/api/jobs", data={"op": "pdf.to_txt"}, files=[("files", ("r.pdf", pdf))])
    results.append(("reject no consent", "PASS" if r.status_code == 428 else "FAIL", f"HTTP {r.status_code}"))

    # images
    run("image png→jpeg (alpha)", "image.convert", [("a.png", img_bytes("PNG", True))], {"target": "jpeg"}, check=chk_img)
    run("image jpeg→avif", "image.convert", [("a.jpg", img_bytes("JPEG"))], {"target": "avif"}, check=chk_img)
    run("image png→tiff", "image.convert", [("a.png", img_bytes("PNG"))], {"target": "tiff"}, check=chk_img)
    run("image png→ico", "image.convert", [("a.png", img_bytes("PNG"))], {"target": "ico"}, check=chk_img)
    run("image png→gif", "image.convert", [("a.png", img_bytes("PNG"))], {"target": "gif"}, check=chk_img)
    run("image bmp→webp resize", "image.convert", [("a.bmp", img_bytes("BMP"))], {"target": "webp", "width": 32}, check=chk_img)
    h = heic_bytes()
    if h:
        run("image heic→jpeg", "image.convert", [("a.heic", h)], {"target": "jpeg"}, check=chk_img)
    else:
        results.append(("image heic→jpeg", "SKIP", "pillow-heif cannot encode HEIF here"))

    # data
    csv = b"name,qty\napple,3\npear,5\n"
    run("data csv→xlsx", "data.convert", [("a.csv", csv)], {"target": "xlsx"}, check=chk_xlsx)
    run("data csv→json", "data.convert", [("a.csv", csv)], {"target": "json"}, check=chk_text)
    run("data csv→tsv", "data.convert", [("a.csv", csv)], {"target": "tsv"}, check=chk_text)
    run("data xlsx→csv (2 sheets)", "data.convert", [("a.xlsx", sample_xlsx())], {"target": "csv"}, check=chk_zip)
    run("data json→csv", "data.convert", [("a.json", b'[{"a":1,"b":{"c":2}},{"a":3}]')], {"target": "csv"}, check=chk_text)
    run("data json→xml", "data.convert", [("a.json", b'[{"a":1}]')], {"target": "xml"}, check=chk_text)
    run("data xml→json", "data.convert", [("a.xml", b"<?xml version='1.0'?><r><a>1</a></r>")], {"target": "json"}, check=chk_text)
    run("data md→html", "data.convert", [("a.md", b"# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n")], {"target": "html"}, check=chk_text)
    run("data md→pdf", "data.convert", [("a.md", b"# Title\n\nHello **world**\n")], {"target": "pdf"}, check=chk_pdf)
    run("data html→md", "data.convert", [("a.html", b"<html><body><h1>Hi</h1><p>x</p></body></html>")], {"target": "md"}, check=chk_text)
    run("data bad pair", "data.convert", [("a.xml", b"<?xml version='1.0'?><r/>")], {"target": "xlsx"}, expect="failed")
    run("data invalid json", "data.convert", [("a.json", b'[{"a":1,}]')], {"target": "csv"}, expect="failed")

    # office (LibreOffice)
    if lo:
        run("office docx→pdf", "office.convert", [("a.docx", sample_docx())], {"target": "pdf"}, check=chk_pdf)
        run("office docx→odt", "office.convert", [("a.docx", sample_docx())], {"target": "odt"}, check=chk_zip)
        run("office pptx→pdf", "office.convert", [("a.pptx", sample_pptx())], {"target": "pdf"}, check=chk_pdf)
        run("office xlsx→csv", "office.convert", [("a.xlsx", sample_xlsx())], {"target": "csv"})
        run("office csv→xlsx", "office.convert", [("a.csv", csv)], {"target": "xlsx"}, check=chk_xlsx)
        run("office pptx→csv rejected", "office.convert", [("a.pptx", sample_pptx())], {"target": "csv"}, expect="failed")
        run("office pptx→png", "office.to_images", [("a.pptx", sample_pptx())], {"format": "png"}, check=chk_zip)
        run("office pptx→video", "office.to_video", [("a.pptx", sample_pptx())], {"secondsPerSlide": 1, "width": 640})
        run("data md→docx", "data.convert", [("a.md", b"# T\n\ntext\n")], {"target": "docx"}, check=chk_docx)
    else:
        results.append(("office.* (LibreOffice)", "SKIP", "LibreOffice not installed"))
    run("pdf→video", "office.to_video", [("r.pdf", pdf)], {"secondsPerSlide": 1, "width": 640})
    run("pdf→webp slides", "office.to_images", [("r.pdf", pdf)], {"format": "webp"}, check=chk_zip)

    w = max(len(r[0]) for r in results)
    for label, status, detail in results:
        print(f"{status:4}  {label:<{w}}  {detail}")
    fails = sum(1 for r in results if r[1] == "FAIL")
    print(f"\n{len(results)} checks, {fails} failed, {sum(1 for r in results if r[1] == 'SKIP')} skipped")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
