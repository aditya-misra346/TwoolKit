# Vellum Processing API — Contract (v1)

Backend: FastAPI (Python 3.13, venv at `backend/.venv`), runs on `http://127.0.0.1:8000`.
Frontend (Next.js, port 3000) proxies `/api/*` → backend via rewrites, so all calls are same-origin `/api/...`.

## Principles
- Real engines only. Never rename extensions to fake a conversion. Validate every output (open it with the relevant library) before marking a job complete.
- Every server request that uploads user files MUST carry header `X-Cloud-Consent: granted`; otherwise 428 with a clear message.
- Files live in a per-job temp dir (`backend/var/jobs/<job_id>/`, mode 0700). Retention: deleted automatically `RETENTION_MINUTES` (default 30) after job completion, or immediately on `DELETE /api/jobs/{id}`. Cleanup loop runs every 60s, and on startup wipes stale dirs.
- Limits: max 200 MB per file, max 20 files per job, per-IP rate limit (token bucket, e.g. 60 job creations / 5 min) → 429 with `Retry-After`.
- Filenames sanitized (basename only, strip control/RTL chars, max 180 chars). Never trust client MIME; detect by magic bytes and verify it matches what the op accepts.
- Progress must be real: either a fraction derived from real work units (pages/slides/files processed) or `null` (indeterminate) with a stage message. Never time-based fake progress.
- Errors: actionable human message in `error` (e.g. "This PDF is password-protected. Provide the password in the Unlock tool first.").

## Endpoints

### `GET /api/health` → `{ "ok": true, "version": "1.0.0" }`

### `GET /api/capabilities`
```json
{
  "engines": {
    "libreoffice": { "available": true, "version": "24.x", "detail": "..." },
    "pymupdf": { "available": true, "version": "1.26.x" },
    "pdf2docx": { "available": true },
    "pikepdf": { "available": true },
    "pillow": { "available": true, "heif": true, "avif": true },
    "tesseract": { "available": false, "detail": "Install with `brew install tesseract`" },
    "clamav": { "available": false, "detail": "Install ClamAV (`brew install clamav`) and run freshclam" },
    "ghostscript": { "available": false },
    "rembg": { "available": false, "detail": "pip install rembg (downloads ~170MB model)" },
    "video": { "available": true, "codec": "avc1|vp80|mp4v", "container": "mp4|webm" }
  },
  "ops": { "<op name>": { "available": true, "reason": null } },
  "limits": { "maxFileMB": 200, "maxFilesPerJob": 20, "retentionMinutes": 30 }
}
```

### `POST /api/jobs` (multipart/form-data)
Fields: `op` (string), `options` (JSON string, optional), `files` (1..N files).
Response `202`: `{ "id": "<uuid>", "status": "queued" }`.
Errors: 400 bad op/options, 413 too large, 415 wrong file type for op (message says detected type), 428 no consent, 429 rate limit, 503 engine unavailable.

### `GET /api/jobs/{id}`
```json
{
  "id": "...", "op": "pdf.to_docx", "status": "queued|running|completed|failed|cancelled",
  "progress": 0.42,            // or null when indeterminate
  "stage": "Rendering page 5 of 12",
  "createdAt": 1730000000.0, "startedAt": ..., "finishedAt": ...,
  "inputs": [{ "name": "a.pdf", "size": 12345, "detectedType": "pdf" }],
  "outputs": [{ "index": 0, "name": "a.docx", "size": 23456, "mime": "application/vnd...", "note": null }],
  "warnings": ["Fonts not embedded in source were substituted."],
  "error": null,
  "expiresAt": 1730001800.0
}
```

### `POST /api/jobs/{id}/cancel` → `{ "status": "cancelled" }` (cooperative: checked between work units; LibreOffice subprocess is killed).
### `GET /api/jobs/{id}/outputs/{index}` → file download (Content-Disposition attachment, correct MIME, `Cache-Control: no-store`).
### `DELETE /api/jobs/{id}` → deletes all server-side files for the job immediately. `{ "deleted": true }`.

## Ops (names are exact)

| op | inputs | options | output |
|---|---|---|---|
| `pdf.to_docx` | pdf | `{ password? }` | .docx (pdf2docx) |
| `pdf.to_pptx` | pdf | `{ mode: "hybrid"\|"image", dpi?: 150, password? }` | .pptx. hybrid = page rendered with text removed as background + editable positioned text boxes; image = full-page images |
| `pdf.to_xlsx` | pdf | `{ password? }` | .xlsx — one sheet per detected table (PyMuPDF `find_tables`); if none, a "Text" sheet of lines + warning |
| `pdf.to_html` | pdf | `{}` | .html (single file, PyMuPDF xhtml/html per page, images embedded) |
| `pdf.to_svg` | pdf | `{ pages?: "1-3,5" }` | .svg (1 page) or .zip of svgs |
| `pdf.to_txt` | pdf | `{}` | .txt |
| `pdf.compress` | pdf | `{ level: "low"\|"balanced"\|"max", password? }` | .pdf. Real image downsampling/recompression + garbage collection + object streams. If result ≥ input, return original bytes and a note "Already optimized; no smaller version produced." |
| `pdf.protect` | pdf | `{ userPassword, ownerPassword?, allowPrint?: true, allowCopy?: true, allowModify?: true }` | .pdf AES-256 (pikepdf) |
| `pdf.unlock` | pdf | `{ password }` | .pdf decrypted. Wrong password → failed "Incorrect password." |
| `pdf.repair` | pdf | `{}` | .pdf (pikepdf/qpdf repair, fallback PyMuPDF garbage=4). Note what was repaired if detectable. |
| `office.convert` | doc docx odt rtf txt html xls xlsx ods csv ppt pptx odp | `{ target: "pdf"\|"docx"\|"odt"\|"rtf"\|"txt"\|"html"\|"doc"\|"xlsx"\|"ods"\|"csv"\|"xls"\|"pptx"\|"odp"\|"ppt" }` | LibreOffice headless. Validate target makes sense for input family; reject meaningless combos. |
| `office.to_images` | ppt pptx odp doc docx odt (also pdf) | `{ format: "jpeg"\|"png"\|"webp", dpi?: 150, quality?: 90 }` | .zip of page/slide images (LO→PDF→PyMuPDF render) — per-slide progress |
| `office.to_video` | ppt pptx odp pdf | `{ secondsPerSlide?: 3, width?: 1920 }` | .mp4/.webm via OpenCV VideoWriter (try avc1 → vp80/webm → mp4v). No animations/transitions (warn). |
| `data.convert` | csv tsv json xml md html txt xlsx | `{ target: "csv"\|"tsv"\|"json"\|"xml"\|"md"\|"html"\|"txt"\|"xlsx"\|"pdf"\|"docx" }` | Python-native conversions (csv module, openpyxl, xmltodict, markdown, markdownify). md/html → pdf/docx goes md→html→LibreOffice. xlsx → csv: one CSV per sheet (zip if >1). |
| `image.convert` | jpeg png webp avif gif bmp tiff ico heic heif | `{ target: "jpeg"\|"png"\|"webp"\|"avif"\|"gif"\|"bmp"\|"tiff"\|"ico", quality?: 85, width?, height?, keepMetadata?: false, background?: "#ffffff" }` | Pillow (+pillow-heif). Used as fallback when the browser can't decode/encode (HEIC, AVIF encode, TIFF). Flatten alpha onto background for JPEG/BMP and add warning. |
| `image.remove_bg` | jpeg png webp | `{}` | .png (rembg) — only if rembg installed, else op unavailable |
| `security.clamav` | any | `{}` | No output file; result in `outputs: []` and `"scan": [{ "name", "status": "clean"\|"infected"\|"error", "signature"? }]` field. Only if clamscan/clamdscan available. |
