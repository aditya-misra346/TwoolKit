# TwoolKit Desktop — Automatic Updates & Website Synchronization

TwoolKit Desktop uses a **Dual-Layer Update Ecosystem** so that ordinary website improvements are delivered instantaneously without reinstalling the desktop app, while native Rust/OS changes are delivered via cryptographically signed native updates.

---

## 1. Layer 1: Automatic Website Synchronization (`https://twoolkit.vercel.app`)

### How It Works
1. **Deployment Manifest Endpoint (`/api/desktop-manifest`)**:
   - Hosted on `https://twoolkit.vercel.app/api/desktop-manifest`.
   - Returns:
     ```json
     {
       "product": "TwoolKit",
       "appVersion": "1.2.0",
       "gitSha": "e708bad...",
       "buildTimestamp": "2026-11-04T20:12:00.000Z",
       "minDesktopVersion": "1.0.0",
       "canonicalOrigin": "https://twoolkit.vercel.app"
     }
     ```
2. **Polling & Focus Detection**:
   - The Rust `check_website_sync` command and `DesktopBridgeProvider` check `/api/desktop-manifest` at startup, whenever the application window regains focus, and every 5 minutes.
3. **Compatibility Gate (`minDesktopVersion`)**:
   - Before applying or reloading a newly deployed website update, TwoolKit Desktop compares its native Rust version (`CARGO_PKG_VERSION`) against `minDesktopVersion` using semantic version comparison.
   - If `nativeVersion < minDesktopVersion`, the app prevents loading an incompatible UI and prompts the user to install the required Native Desktop Update first.
4. **Zero-Interruption Reload**:
   - If the user has active conversion or compression jobs running in `useQueue`, the update notification waits calmly and never interrupts an in-progress task.
   - Clicking **Apply Update Now** refreshes the cache-busted frontend view immediately.

---

## 2. Layer 2: Signed Native Desktop Updater (`tauri-plugin-updater`)

When changes are made to `desktop/src-tauri/**` (Rust commands, filesystem capabilities, native menus, or security rules):

1. **Ed25519 Cryptographic Signing**:
   - Every release artifact (`.app.tar.gz`, `.nsis.zip` / `.msi`, `.AppImage.tar.gz`) is signed during CI build using `TAURI_SIGNING_PRIVATE_KEY`.
   - The corresponding public key is embedded in `desktop/src-tauri/tauri.conf.json` (`plugins.updater.pubkey`).
2. **Update Discovery (`latest.json`)**:
   - The updater queries the official release manifest endpoint:
     `https://github.com/aditya-misra346/TwoolKit/releases/latest/download/latest.json`
3. **Verification & Atomic Installation**:
   - Downloads the update in the background with byte-level progress reporting.
   - Verifies the Ed25519 signature against the embedded public key (rejecting any unsigned, tampered, or downgraded binary).
   - Preserves all user settings, authorized folders, and IndexedDB history across restarts.
