# TWOOLKIT — All-in-One File Management, Scanning & Conversion Platform

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwind-css)
![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.13-009688?style=flat-square&logo=fastapi)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

An extraordinarily polished, premium, enterprise-grade, all-in-one file management productivity platform combining document scanning, file analysis, storage management, document conversion, image conversion, multi-tier compression, complete PDF utilities, and advanced file organization.

---

## Key Features

1. **Main Dashboard**: Real-time storage distribution donut chart, genuine file metrics (analyzed, duplicates, compressed savings, conversions), recent activity timeline, and quick-action tool shortcuts.
2. **Advanced File Scanner**: Supports single files, batches, and folder structures (File System Access API). Detects MIME types, cryptographic SHA-256 hashes, perceptual image hashes (`dHash`), extension spoofing, double extensions, and disguised binaries.
3. **Storage Manager**: Identifies redundant duplicates, oversized media (>20MB), and temporary cache files with estimated recoverable storage and a virtual in-app Recycle Bin for safe restoration.
4. **Complete PDF Toolkit**:
   - In-browser: Merge, split, organize, rotate, watermark, page numbers, header/footer, signature stamp, crop, and images-to-PDF.
   - High-fidelity backend: PDF to Word (DOCX layout reconstruction), PDF to PowerPoint (hybrid editable text mode), PDF to Excel (table detection), SVG, HTML, TXT, image extraction, AES-256 protect/unlock, and structural repair.
5. **Universal Document & Presentation Converter**: Powered by headless LibreOffice and native parsers for Word, Spreadsheets, Presentations, Markdown, HTML, CSV, JSON, and XML.
6. **Presentation Studio**: Convert PPTX/PPT/ODP into slide images (PNG/JPEG/WebP) or slideshow videos (MP4 with OpenCV).
7. **Image Studio & Converter**: Convert between JPEG, PNG, WebP, AVIF, HEIC, TIFF, GIF, BMP, and ICO. Resize, rotate, flip, grayscale, and strip EXIF/GPS metadata.
8. **File Compressor**: Low, Balanced, and Maximum compression tiers across PDFs, images, Office files, and ZIP archives.
9. **Batch Processing Engine**: Slide-over queue with real progress tracking, pause/resume, task retry, and 1-click bulk ZIP download.
10. **Intelligent File Assistant**: Document summarization, key fact extraction, formatting risk advisor, and optional Google Gemini API integration.

---

## Deployment on Vercel

This repository is configured for zero-config automatic deployment on Vercel:

1. Import this repository into [Vercel](https://vercel.com/new).
2. Vercel automatically detects Next.js using the root `vercel.json` and `package.json`.
3. Set the Environment Variable `BACKEND_URL` in Vercel to point to your deployed backend API (or leave it to run all in-browser features 100% client-side).
4. Every push to the `main` branch triggers an automated build and production deployment.

---

## Local Development

```bash
# 1. Start Python Processing Backend (Port 8000)
cd backend
./run.sh

# 2. Start Next.js Frontend (Port 3000)
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
