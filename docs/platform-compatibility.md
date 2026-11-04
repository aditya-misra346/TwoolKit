# TwoolKit Desktop — Cross-Platform Compatibility Matrix

## 1. Operating System & Package Matrix

| Platform | Target Triple | Installer Formats | Built-in In-App Updater | Native File Dialogs & Drag-Drop |
|---|---|---|---|---|
| **macOS (Apple Silicon)** | `aarch64-apple-darwin` | `.dmg`, `.app.tar.gz` | Supported (`tauri-plugin-updater`) | Native Cocoa `NSOpenPanel` / `NSSavePanel` |
| **macOS (Intel)** | `x86_64-apple-darwin` | `.dmg`, `.app.tar.gz` | Supported (`tauri-plugin-updater`) | Native Cocoa `NSOpenPanel` / `NSSavePanel` |
| **Windows (64-bit)** | `x86_64-pc-windows-msvc` | `.exe` (NSIS), `.msi` (WiX) | Supported (`tauri-plugin-updater`) | Native Win32 `IFileDialog` & Explorer drop |
| **Windows (ARM64)** | `aarch64-pc-windows-msvc` | `.exe` (NSIS) | Supported (`tauri-plugin-updater`) | Native Win32 `IFileDialog` & Explorer drop |
| **Linux (x86_64)** | `x86_64-unknown-linux-gnu` | `.AppImage`, `.deb`, `.rpm` | Supported on `.AppImage` (`.deb`/`.rpm` update via apt/dnf) | GTK3 / XDG Desktop Portal dialogs |
| **Linux (ARM64)** | `aarch64-unknown-linux-gnu` | `.AppImage`, `.deb` | Supported on `.AppImage` | GTK3 / XDG Desktop Portal dialogs |

---

## 2. Feature & Engine Compatibility Across Platforms

| Tool Category | Count | Offline / Local Execution | Cloud / Local Python Server Execution |
|---|---|---|---|
| **File Scanner & Duplicate Finder** | 3 | 100% Local (Rust native folder walker + WebAssembly SHA-256 & pHash) | Optional ClamAV signature scan |
| **Storage Manager & Recycle Bin** | 2 | 100% Local (Scoped Rust directory telemetry + virtual & native trash) | N/A |
| **File Organizer & ZIP Studio** | 2 | 100% Local (Native rename/copy/move + JSZip with Zip-Slip guard) | N/A |
| **PDF Manipulation & Security** | 19 | 100% Local (`pdf-lib`, `pdfjs-dist`, AES-256 `pdf-encrypt`, `tesseract.js` OCR) | Optional `pikepdf` / `PyMuPDF` high-speed stream compression |
| **PDF Conversion Suite** | 8 | Local fallback for DOCX, PPTX, XLSX, HTML, TXT, Images | High-fidelity `pdf2docx` & `PyMuPDF` when server online |
| **Document & Presentation Studio** | 3 | Local CSV/TSV/JSON/Markdown/HTML parser | Headless LibreOffice & OpenCV slideshow video when server online |
| **Advanced Image Studio** | 4 | 100% Local (WEBP, PNG, JPEG, AVIF, BMP, GIF, ICO, TIFF, SVG, EXIF strip) | Optional `pillow-heif` fallback for exotic HEIC streams |
| **File Compressor & AI Assistant** | 2 | Local PDF/Image/ZIP compression + local document heuristics | Optional Gemini API semantic summarization |
