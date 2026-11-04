# TwoolKit Desktop (Tauri 2 + Rust)

Official cross-platform desktop application for **TwoolKit** (`https://twoolkit.vercel.app/`), built with **Tauri 2** and **Rust** for macOS (`aarch64` & `x86_64`), Windows (`x86_64` & `aarch64`), and Linux (`AppImage`, `.deb`, `.rpm`).

## Key Capabilities

1. **Instant Live Website Synchronization**:
   - Automatically stays synchronized with the latest deployed version of `https://twoolkit.vercel.app` via `/api/desktop-manifest` without requiring users to reinstall the desktop application.
   - Enforces semantic version compatibility checks (`minDesktopVersion`) before applying remote frontend updates.
2. **Scoped Native Filesystem Engine (`src-tauri/src/fs_ops.rs`)**:
   - Native OS file and folder selection dialogs (`rfd`).
   - Multi-threaded recursive directory scanning with streaming SHA-256 calculation and 4 KB magic-byte signature extraction.
   - Strict user-authorized path allowlisting (`src-tauri/src/security.rs`) — zero silent disk scanning.
   - Scoped native file rename, copy, move, mkdir, and confirmed deletion.
3. **Cryptographically Signed Native Updater (`tauri-plugin-updater`)**:
   - Separate Ed25519-signed update pipeline for native Rust commands and Tauri capabilities.
4. **Encrypted Credential Vault (`src-tauri/src/security.rs`)**:
   - Protects user session tokens and optional API keys in an OS-restricted (`0600`) local vault.

## Commands

```bash
# Run Rust unit & integration test suite
npm run rust:test

# Run Rust formatting & Clippy lint verification
npm run rust:fmt
npm run rust:clippy

# Launch in development mode
npm run tauri:dev

# Build production installer bundles
npm run tauri:build
```
