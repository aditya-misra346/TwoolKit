# TwoolKit Desktop — Release Process & Signing Key Management

This document explains how to cut a new release of **TwoolKit Desktop** and how GitHub Actions automates multi-platform builds and signed updates.

---

## 1. Generating Tauri Updater Signing Keys (One-Time Setup)

Tauri 2 uses Ed25519 signatures to verify native updates. Generate a keypair locally (never commit the private key):

```bash
cd desktop
npx @tauri-apps/cli signer generate -w ~/.tauri/twoolkit.key
```

This outputs:
1. **Private Key (`~/.tauri/twoolkit.key`)**:
   Add this to your GitHub repository under **Settings → Secrets and variables → Actions**:
   - `TAURI_SIGNING_PRIVATE_KEY`: Contents of `~/.tauri/twoolkit.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Password chosen during generation
2. **Public Key (`~/.tauri/twoolkit.key.pub`)**:
   Paste the public key string into `desktop/src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.

---

## 2. Optional Platform Code-Signing Secrets

For notarized macOS and SmartScreen-trusted Windows builds, configure these optional GitHub Actions secrets:

### macOS Notarization Secrets
- `APPLE_CERTIFICATE`: Base64-encoded `.p12` Developer ID Application certificate
- `APPLE_CERTIFICATE_PASSWORD`: Password for the `.p12` certificate
- `APPLE_SIGNING_IDENTITY`: e.g. `Developer ID Application: Aditya Misra (TEAMID)`
- `APPLE_ID`: Apple Developer account email
- `APPLE_PASSWORD`: App-specific password for notarization
- `APPLE_TEAM_ID`: 10-character Apple Team ID

### Windows Code Signing Secrets
- `WINDOWS_CERTIFICATE`: Base64-encoded `.pfx` / EV code signing certificate
- `WINDOWS_CERTIFICATE_PASSWORD`: Certificate password

*(If these optional OS vendor certificates are not set in GitHub Secrets, the workflow still builds and publishes functional installers and Tauri-signed updater bundles).*

---

## 3. How Change Detection Works

| What Changed | Triggered Pipeline | Result |
|---|---|---|
| `frontend/**` or `backend/**` pushed to `main` | `.github/workflows/ci-web.yml` + Vercel | Runs frontend/backend tests; Vercel deploys `https://twoolkit.vercel.app`; existing desktop apps sync automatically via `/api/desktop-manifest` |
| `desktop/**` pushed to `main` | `.github/workflows/desktop-release.yml` (validation job) | Runs `cargo fmt`, `cargo clippy`, `cargo test`, and frontend compatibility checks |
| Git tag `desktop-v*` (e.g. `desktop-v1.2.0`) or manual workflow dispatch | `.github/workflows/desktop-release.yml` (full matrix build) | Builds macOS (`aarch64`, `x86_64`), Windows (`x86_64`), and Linux (`AppImage`, `deb`, `rpm`) installers, signs updater artifacts, and publishes GitHub Release with `latest.json` |

---

## 4. Cutting a Native Desktop Release

1. Bump the version in `desktop/package.json` and `desktop/src-tauri/Cargo.toml` and `desktop/src-tauri/tauri.conf.json` (e.g. `1.2.0`).
2. Commit and push to `main`:
   ```bash
   git commit -am "chore(desktop): release v1.2.0"
   git tag desktop-v1.2.0
   git push origin main --tags
   ```
3. GitHub Actions automatically builds all three operating systems, generates `latest.json`, and publishes the release.
