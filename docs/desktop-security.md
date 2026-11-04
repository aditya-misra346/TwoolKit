# TwoolKit Desktop — Security & Native API Protection

TwoolKit Desktop processes confidential PDFs, financial spreadsheets, personal photos, and local folders. Security is enforced at every layer of the Tauri 2 + Rust architecture.

---

## 1. Scoped Filesystem Access (Zero Silent Disk Scanning)

- **Explicit User Authorization Only**:
  - Frontend JavaScript cannot read arbitrary filesystem paths.
  - A directory or file path can only be accessed by Rust commands (`scan_authorized_directory`, `read_authorized_file`, `native_file_op`) after the user explicitly selects it via the native OS folder/file picker (`authorize_directory` / `pick_native_files`) or drags and drops it from Finder/Explorer.
- **In-Memory & Persisted Allowlist (`AuthorizedGrantStore`)**:
  - `desktop/src-tauri/src/security.rs` maintains the canonicalized allowlist of user-approved directory roots.
  - Every file operation canonicalizes the requested path (`std::fs::canonicalize`) and verifies:
    1. The path is inside an explicitly authorized directory root.
    2. The path contains no parent directory traversal (`..`) or null bytes.
    3. The path is not a sensitive system root (`/System`, `/etc`, `/usr`, `C:\Windows`, `~/.ssh`, `~/.aws`, `~/.gnupg`).
- **Revocable Grants**:
  - Users can inspect and revoke any authorized folder at any time in **Settings → Desktop & Native Controls → Authorized Folders**.

---

## 2. Strict Origin & CSP Isolation

- **Locked Navigation Origin**:
  - The privileged Tauri WebView only permits navigation to the local `tauri://localhost` bundle and `https://twoolkit.vercel.app`.
  - Any external links (e.g., GitHub documentation) are intercepted and opened externally in the user's default system browser via `tauri-plugin-shell` / `opener`.
- **Content Security Policy (CSP)**:
  - Configured in `desktop/src-tauri/tauri.conf.json` to block arbitrary third-party script execution (`script-src 'self' 'wasm-unsafe-eval'`), restrict `connect-src` to `https://twoolkit.vercel.app`, `http://127.0.0.1:8000`, and GitHub release endpoints, and disallow `<object>`/`<frame>` embedding.

---

## 3. Secure Credential Storage

- Sensitive tokens (such as the optional Gemini API Key or user session credentials) are stored in an encrypted local vault (`desktop/src-tauri/src/security.rs`) with `0600` file permissions inside the OS-protected app data directory, never exposed in plaintext bundles or URL query parameters.

---

## 4. Safe Archive & Filename Handling

- Both the frontend (`archiveClient.ts`) and Rust native file operations sanitize filenames (stripping control characters, right-to-left override `\u202e`, and relative `../` segments) to prevent Zip-Slip and path traversal attacks.
