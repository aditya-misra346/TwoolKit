# TwoolKit Desktop — Installation Guide (macOS, Windows, Linux)

TwoolKit Desktop is available for **macOS**, **Windows**, and **Linux** from the official download page at [`https://twoolkit.vercel.app/download`](https://twoolkit.vercel.app/download) or from [GitHub Releases](https://github.com/aditya-misra346/TwoolKit/releases).

---

## 1. System Requirements

| Operating System | Supported Versions | Architectures | Minimum RAM / Disk |
|---|---|---|---|
| **macOS** | macOS 12.0 (Monterey) or later | Apple Silicon (`arm64`) & Intel (`x86_64`) | 4 GB RAM · 150 MB disk |
| **Windows** | Windows 10 (1809+) & Windows 11 (WebView2 Runtime) | `x86_64` (64-bit) & `ARM64` | 4 GB RAM · 150 MB disk |
| **Linux** | Ubuntu 22.04+, Debian 12+, Fedora 39+ | `x86_64` & `aarch64` | 4 GB RAM · 150 MB disk |

---

## 2. Installing on macOS (`.dmg` / `.app`)

1. Download the appropriate installer for your Mac from `/download`:
   - **Apple Silicon (M1 / M2 / M3 / M4)**: `TwoolKit_1.2.0_aarch64.dmg`
   - **Intel Mac**: `TwoolKit_1.2.0_x64.dmg`
2. Double-click the `.dmg` file to mount the disk image.
3. Drag **TwoolKit.app** into the **Applications** folder.
4. Launch **TwoolKit** from Applications, Spotlight (`⌘ Space`), or Launchpad.
5. **Filesystem Permissions**: TwoolKit Desktop never scans your disk without permission. When you click **Scan Folder** or **Open Files**, macOS presents the native Finder dialog to grant scoped access to your chosen folder.

---

## 3. Installing on Windows (`.msi` / `.exe`)

1. Download the Windows installer from `/download`:
   - **NSIS Setup (Recommended)**: `TwoolKit_1.2.0_x64-setup.exe`
   - **Windows Installer Package**: `TwoolKit_1.2.0_x64_en-US.msi`
2. Run the installer and follow the setup wizard.
   - *Note*: Windows 11 includes the Microsoft Edge WebView2 Runtime pre-installed. On older Windows 10 systems, the installer automatically provisions WebView2 if missing.
3. Launch **TwoolKit Desktop** from the Start Menu or Desktop shortcut.
4. **Uninstallation**: Use **Settings → Apps → Installed Apps → TwoolKit → Uninstall** at any time.

---

## 4. Installing on Linux (`AppImage`, `.deb`, `.rpm`)

### Option A: AppImage (Recommended — Supports Built-in Automatic Updates)
```bash
chmod +x TwoolKit_1.2.0_amd64.AppImage
./TwoolKit_1.2.0_amd64.AppImage
```
> **Note on Linux Automatic Updates**: `AppImage` is the primary format supporting in-app atomic self-updates via the Tauri 2 updater.

### Option B: Ubuntu / Debian (`.deb`)
```bash
sudo apt install ./TwoolKit_1.2.0_amd64.deb
```
To update a `.deb` installation, download the newer `.deb` release package or use your configured apt repository.

### Option C: Fedora / RHEL / openSUSE (`.rpm`)
```bash
sudo dnf install ./TwoolKit-1.2.0-1.x86_64.rpm
```
To update an `.rpm` installation, run `sudo dnf upgrade ./TwoolKit-<version>.x86_64.rpm`.
