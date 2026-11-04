# TwoolKit Desktop — Developer Guide

This guide explains how to develop, run, test, and debug **TwoolKit Desktop** locally alongside the Next.js frontend and Python FastAPI backend.

---

## 1. Prerequisites

1. **Node.js 20+** and **npm**:
   ```bash
   node --version
   npm --version
   ```
2. **Rust Toolchain (`rustup`, `cargo`, `rustc` 1.77+)**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
3. **Python 3.11+** (for local high-fidelity server conversions on port `8000`):
   ```bash
   cd backend && ./run.sh
   ```
4. **Platform-Specific System Dependencies**:
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
   - **Ubuntu/Debian Linux**:
     ```bash
     sudo apt update
     sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
     ```
   - **Windows**: Microsoft Visual Studio C++ Build Tools & WebView2 Runtime.

---

## 2. Project Structure

```text
TwoolKit/
├── frontend/                  # Shared Next.js 16 application (Web + Desktop UI)
│   ├── src/lib/desktop.ts     # TypeScript bridge to Tauri 2 native commands
│   ├── src/components/DesktopBridgeProvider.tsx # Global shortcuts, sync & drag-drop
│   ├── src/app/download/      # OS-aware Desktop Download center
│   └── src/app/api/desktop-manifest/ # Live synchronization manifest endpoint
├── backend/                   # Python FastAPI processing engine (port 8000)
├── desktop/                   # Tauri 2 Desktop Application
│   ├── package.json           # Tauri CLI scripts (dev, build, check, test)
│   ├── scripts/               # Build & key generation helper scripts
│   └── src-tauri/             # Rust native core
│       ├── Cargo.toml         # Rust dependencies & crate config
│       ├── tauri.conf.json    # Window, CSP, bundle & updater configuration
│       ├── capabilities/      # Strict Tauri 2 permission capabilities
│       ├── icons/             # Multi-resolution .icns, .ico, and .png icons
│       └── src/
│           ├── main.rs        # Binary entrypoint
│           ├── lib.rs         # Tauri builder, menu, plugins & IPC handlers
│           ├── fs_ops.rs      # Scoped native filesystem & SHA-256 scanner
│           ├── security.rs    # Path validation, allowlist & credential vault
│           └── sync.rs        # Website manifest poller & compatibility verifier
```

---

## 3. Running in Development Mode

From the repository root:

```bash
# 1. Start the Python processing backend (optional, for server conversions)
./backend/run.sh &

# 2. Launch TwoolKit Desktop in development mode (starts Next.js + Tauri window)
npm run desktop:dev
```

Or directly inside `desktop/`:
```bash
cd desktop
npm install
npm run tauri:dev
```

---

## 4. Running Checks & Automated Tests

```bash
# Frontend TypeScript & production build check
cd frontend && npx tsc --noEmit && npm run build

# Rust formatting, Clippy linter, and unit tests
cd desktop/src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```
