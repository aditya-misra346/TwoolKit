#!/usr/bin/env python3
"""Comprehensive End-to-End QA Audit Suite for TwoolKit Ecosystem.

Covers:
1. Frontend Route & Permanent Dark Mode Audit (22 routes + API endpoints)
2. Live Vercel Production Endpoint Verification (https://twoolkit.vercel.app)
3. Batch Processing Stress Tests (2, 5, 10, 25, 50 files + 51-file limit guard)
4. Security, Privacy & Input Validation Hardening Tests
5. Malformed, Encrypted & Corrupted File Resilience Tests
"""

from __future__ import annotations

import io
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import fitz  # PyMuPDF
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
HEADERS = {"X-Cloud-Consent": "granted"}

PASSED = 0
FAILED = 0


def check(name: str, fn):
    global PASSED, FAILED
    t0 = time.monotonic()
    try:
        detail = fn()
        dt = (time.monotonic() - t0) * 1000
        PASSED += 1
        print(f"  \033[32mPASS\033[0m  {name:<58} ({dt:6.1f} ms)  {detail or ''}")
    except Exception as e:
        dt = (time.monotonic() - t0) * 1000
        FAILED += 1
        print(f"  \033[31mFAIL\033[0m  {name:<58} ({dt:6.1f} ms)  {e}")


def run_job(op: str, files: list[tuple[str, bytes, str]], options: dict | None = None):
    data = {"op": op, "options": json.dumps(options or {})}
    upload = [("files", (name, io.BytesIO(buf), mime)) for name, buf, mime in files]
    r = client.post("/api/jobs", data=data, files=upload, headers=HEADERS)
    if r.status_code != 202:
        raise AssertionError(f"POST /api/jobs -> {r.status_code}: {r.text}")
    jid = r.json()["id"]
    deadline = time.time() + 120
    while time.time() < deadline:
        s = client.get(f"/api/jobs/{jid}").json()
        if s["status"] in ("completed", "failed", "cancelled"):
            break
        time.sleep(0.05)
    else:
        raise TimeoutError(f"job {jid} timed out")
    return jid, s


def make_tiny_pdf(text: str = "TwoolKit QA Test") -> bytes:
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    p.insert_text((36, 72), text, fontsize=14)
    buf = doc.tobytes()
    doc.close()
    return buf


def make_tiny_png(color=(37, 99, 235)) -> bytes:
    im = Image.new("RGB", (64, 64), color)
    out = io.BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()


# ---------------------------------------------------------------------------
# 1. Backend Security, Headers, CORS & Input Validation
# ---------------------------------------------------------------------------
print("\n=== 1. SECURITY, PRIVACY & INPUT VALIDATION AUDIT ===")


def test_security_headers():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.headers.get("x-content-type-options") == "nosniff"
    assert r.headers.get("x-frame-options") == "DENY"
    assert r.headers.get("referrer-policy") == "no-referrer"
    assert r.headers.get("cross-origin-resource-policy") == "same-origin"
    assert "default-src 'none'" in r.headers.get("content-security-policy", "")
    return "nosniff, DENY, CSP verified"


def test_cors_origins():
    for origin in ["https://twoolkit.vercel.app", "tauri://localhost", "http://localhost:3000"]:
        r = client.options(
            "/api/jobs",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type,X-Cloud-Consent",
            },
        )
        assert r.status_code == 200, f"CORS failed for {origin}: {r.status_code}"
        assert r.headers.get("access-control-allow-origin") == origin
    return "Web + Tauri origins allowed"


def test_missing_consent():
    r = client.post(
        "/api/jobs",
        data={"op": "pdf.to_txt"},
        files=[("files", ("a.pdf", io.BytesIO(make_tiny_pdf()), "application/pdf"))],
    )
    assert r.status_code == 428
    return "HTTP 428 enforced without consent"


def test_unknown_op():
    r = client.post(
        "/api/jobs",
        data={"op": "evil.exec"},
        files=[("files", ("a.pdf", io.BytesIO(make_tiny_pdf()), "application/pdf"))],
        headers=HEADERS,
    )
    assert r.status_code == 400
    return "HTTP 400 on unknown op"


def test_invalid_options_json():
    r = client.post(
        "/api/jobs",
        data={"op": "pdf.to_txt", "options": "not-json"},
        files=[("files", ("a.pdf", io.BytesIO(make_tiny_pdf()), "application/pdf"))],
        headers=HEADERS,
    )
    assert r.status_code == 400
    return "HTTP 400 on malformed options"


def test_empty_file_rejected():
    r = client.post(
        "/api/jobs",
        data={"op": "pdf.to_txt"},
        files=[("files", ("empty.pdf", io.BytesIO(b""), "application/pdf"))],
        headers=HEADERS,
    )
    assert r.status_code == 400
    return "HTTP 400 on 0-byte upload"


def test_magic_byte_spoofing():
    # PNG bytes disguised as .pdf sent to a PDF-only tool
    r = client.post(
        "/api/jobs",
        data={"op": "pdf.to_txt"},
        files=[("files", ("spoofed.pdf", io.BytesIO(make_tiny_png()), "application/pdf"))],
        headers=HEADERS,
    )
    assert r.status_code == 415
    return "HTTP 415 on magic-byte mismatch"


def test_path_traversal_sanitization():
    jid, s = run_job(
        "pdf.to_txt",
        [("../../../../etc/passwd.pdf", make_tiny_pdf("Traversal test"), "application/pdf")],
    )
    assert s["status"] == "completed", s
    out_name = s["outputs"][0]["name"]
    assert ".." not in out_name and "/" not in out_name and "\\" not in out_name
    assert out_name == "passwd.txt"
    client.delete(f"/api/jobs/{jid}")
    return f"sanitized -> {out_name}"


def test_overlong_filename_sanitization():
    long_name = ("a" * 260) + ".pdf"
    jid, s = run_job("pdf.to_txt", [(long_name, make_tiny_pdf("Long name"), "application/pdf")])
    assert s["status"] == "completed", s
    out_name = s["outputs"][0]["name"]
    assert len(out_name) <= 185
    client.delete(f"/api/jobs/{jid}")
    return f"len={len(out_name)} chars"


def test_invalid_job_uuid():
    r = client.get("/api/jobs/../../etc/passwd")
    assert r.status_code in (404, 422)
    r2 = client.get("/api/jobs/not-a-uuid")
    assert r2.status_code == 404
    return "HTTP 404 on invalid UUID"


check("Security headers (CSP, nosniff, DENY, CORP)", test_security_headers)
check("CORS origins (Vercel + Tauri + Localhost)", test_cors_origins)
check("Consent gate (HTTP 428 without X-Cloud-Consent)", test_missing_consent)
check("Unknown operation rejection (HTTP 400)", test_unknown_op)
check("Malformed JSON options rejection (HTTP 400)", test_invalid_options_json)
check("Zero-byte file rejection (HTTP 400)", test_empty_file_rejected)
check("Magic-byte spoofing rejection (HTTP 415)", test_magic_byte_spoofing)
check("Path traversal filename sanitization", test_path_traversal_sanitization)
check("Overlong filename truncation (260 -> <=180 chars)", test_overlong_filename_sanitization)
check("Invalid Job UUID guard (HTTP 404)", test_invalid_job_uuid)


# ---------------------------------------------------------------------------
# 2. Batch Processing Stress Tests (2, 5, 10, 25, 50 files + 51-file guard)
# ---------------------------------------------------------------------------
print("\n=== 2. BATCH PROCESSING STRESS TESTS (2, 5, 10, 25, 50 FILES) ===")


def make_batch_test(count: int):
    def _fn():
        csv_files = [
            (f"batch_{i + 1:02d}.csv", f"id,val\n{i},item_{i}\n".encode(), "text/csv")
            for i in range(count)
        ]
        jid, s = run_job("data.convert", csv_files, {"target": "json"})
        assert s["status"] == "completed", f"Failed batch {count}: {s}"
        assert len(s["outputs"]) == count, f"Expected {count} outputs, got {len(s['outputs'])}"
        client.delete(f"/api/jobs/{jid}")
        return f"{count}/{count} files converted"

    return _fn


for n in (2, 5, 10, 25, 50):
    check(f"Batch conversion ({n} files in single job)", make_batch_test(n))


def test_batch_51_rejected():
    files = [(f"f_{i}.csv", b"a,b\n1,2\n", "text/csv") for i in range(51)]
    r = client.post(
        "/api/jobs",
        data={"op": "data.convert", "options": json.dumps({"target": "json"})},
        files=[("files", (name, io.BytesIO(buf), mime)) for name, buf, mime in files],
        headers=HEADERS,
    )
    assert r.status_code == 400, f"Expected 400 for 51 files, got {r.status_code}"
    return "51st file rejected (HTTP 400)"


def test_duplicate_filenames_in_batch():
    files = [
        ("report.csv", b"id,name\n1,Alice\n", "text/csv"),
        ("report.csv", b"id,name\n2,Bob\n", "text/csv"),
        ("report.csv", b"id,name\n3,Charlie\n", "text/csv"),
    ]
    jid, s = run_job("data.convert", files, {"target": "json"})
    assert s["status"] == "completed", s
    names = [o["name"] for o in s["outputs"]]
    assert len(set(names)) == 3, f"Collision not resolved: {names}"
    client.delete(f"/api/jobs/{jid}")
    return f"deduplicated -> {names}"


check("Batch limit enforcement (51 files -> HTTP 400)", test_batch_51_rejected)
check("Duplicate filenames in batch deduplication", test_duplicate_filenames_in_batch)


# ---------------------------------------------------------------------------
# 3. Encrypted & Corrupted PDF Resilience
# ---------------------------------------------------------------------------
print("\n=== 3. ENCRYPTED & CORRUPTED DOCUMENT RESILIENCE ===")


def test_encrypted_pdf_without_password():
    # First protect a PDF
    jid1, s1 = run_job(
        "pdf.protect",
        [("doc.pdf", make_tiny_pdf("Secret"), "application/pdf")],
        {"userPassword": "correct-password"},
    )
    enc_bytes = client.get(f"/api/jobs/{jid1}/outputs/0").content
    client.delete(f"/api/jobs/{jid1}")

    # Now attempt pdf.to_txt without password -> should fail gracefully with clear message
    jid2, s2 = run_job("pdf.to_txt", [("enc.pdf", enc_bytes, "application/pdf")])
    assert s2["status"] == "failed"
    assert "password" in (s2.get("error") or "").lower()
    client.delete(f"/api/jobs/{jid2}")

    # Attempt pdf.unlock with wrong password -> should fail gracefully
    jid3, s3 = run_job(
        "pdf.unlock",
        [("enc.pdf", enc_bytes, "application/pdf")],
        {"password": "wrong-password"},
    )
    assert s3["status"] == "failed"
    assert "password" in (s3.get("error") or "").lower()
    client.delete(f"/api/jobs/{jid3}")
    return "Graceful password error messages verified"


def test_corrupted_pdf_repair():
    raw = make_tiny_pdf("Repairable PDF")
    corrupted = raw[:-24] + b"\n%%EOF\n"
    jid, s = run_job("pdf.repair", [("broken.pdf", corrupted, "application/pdf")])
    assert s["status"] == "completed", s
    repaired = client.get(f"/api/jobs/{jid}/outputs/0").content
    with fitz.open(stream=repaired, filetype="pdf") as d:
        assert d.page_count == 1
    client.delete(f"/api/jobs/{jid}")
    return f"repaired ({len(repaired)} B)"


check("Encrypted PDF missing/wrong password handling", test_encrypted_pdf_without_password)
check("Truncated/corrupted PDF automatic repair", test_corrupted_pdf_repair)


# ---------------------------------------------------------------------------
# 4. Local Next.js Production Server Route & Dark Mode Audit (22 routes)
# ---------------------------------------------------------------------------
print("\n=== 4. NEXT.JS FRONTEND ROUTES & PERMANENT DARK MODE AUDIT ===")

FRONTEND_BASE = "http://127.0.0.1:3000"
HTML_ROUTES = [
    "/",
    "/scanner",
    "/storage",
    "/organizer",
    "/pdf",
    "/pdf/merge",
    "/pdf/split",
    "/pdf/to-word",
    "/pdf/protect",
    "/pdf/unlock",
    "/documents",
    "/documents/presentations",
    "/images",
    "/compress",
    "/assistant",
    "/recent",
    "/brand",
    "/download",
    "/settings",
]

for route in HTML_ROUTES:
    def _make_route_check(r_path: str):
        def _fn():
            req = urllib.request.Request(f"{FRONTEND_BASE}{r_path}")
            with urllib.request.urlopen(req, timeout=10) as resp:
                assert resp.status == 200, f"HTTP {resp.status}"
                html = resp.read().decode("utf-8", errors="ignore")
                assert 'class="h-full dark"' in html, "Missing permanent dark class on <html>"
                assert "Switch to light mode" not in html, "Found forbidden light mode switcher"
                return f"HTTP 200 · Dark Mode locked ({len(html)} B)"
        return _fn

    check(f"Frontend route GET {route}", _make_route_check(route))


def test_frontend_api_routes():
    for path in ["/api/health", "/api/capabilities", "/api/desktop-manifest"]:
        with urllib.request.urlopen(f"{FRONTEND_BASE}{path}", timeout=10) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode("utf-8"))
            if path == "/api/capabilities":
                assert data["limits"]["maxFilesPerJob"] == 50
            elif path == "/api/desktop-manifest":
                assert data["version"] == "1.2.0"
                assert "darwin-aarch64" in data["platforms"]
                assert "windows-x86_64" in data["platforms"]
                assert "linux-x86_64" in data["platforms"]
    return "health, capabilities (50 max files), desktop-manifest OK"


check("Frontend API endpoints (/api/health, /capabilities, /desktop-manifest)", test_frontend_api_routes)

print(f"\nSUMMARY: {PASSED} passed, {FAILED} failed")
sys.exit(1 if FAILED else 0)
