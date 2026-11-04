import { NextResponse } from "next/server";

export const DESKTOP_RELEASE_VERSION = "1.2.0";
export const MIN_REQUIRED_DESKTOP_VERSION = "1.0.0";
export const RELEASE_DATE = "2026-11-04";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Twoolkit-Desktop-Version",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const gitSha =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.NEXT_PUBLIC_GIT_SHA ||
    "e708bad";

  const githubReleaseBase = `https://github.com/aditya-misra346/TwoolKit/releases/download/desktop-v${DESKTOP_RELEASE_VERSION}`;

  return NextResponse.json(
    {
      product: "TwoolKit Desktop",
      appVersion: DESKTOP_RELEASE_VERSION,
      gitSha,
      buildTimestamp: new Date().toISOString(),
      releaseDate: RELEASE_DATE,
      minDesktopVersion: MIN_REQUIRED_DESKTOP_VERSION,
      canonicalOrigin: "https://twoolkit.vercel.app",
      updaterManifestUrl:
        "https://github.com/aditya-misra346/TwoolKit/releases/latest/download/latest.json",
      channels: {
        stable: {
          version: DESKTOP_RELEASE_VERSION,
          gitSha,
          minDesktopVersion: MIN_REQUIRED_DESKTOP_VERSION,
          publishedAt: `${RELEASE_DATE}T20:00:00Z`,
        },
        beta: {
          version: `${DESKTOP_RELEASE_VERSION}-beta.1`,
          gitSha,
          minDesktopVersion: MIN_REQUIRED_DESKTOP_VERSION,
          publishedAt: `${RELEASE_DATE}T20:00:00Z`,
        },
      },
      releaseNotes: [
        "Unified Tauri 2 + Rust native desktop runtime for macOS, Windows, and Linux.",
        "Automatic live website synchronization with https://twoolkit.vercel.app without full reinstallation.",
        "Scoped native filesystem integration: native Open/Save dialogs, recursive folder scanning with SHA-256 hashing, and direct output saving.",
        "Multi-view interactive storage analytics (Donut, Pie, and Bar charts) and 48 built-in PDF, Document, Presentation, Image, and Security tools.",
        "Ed25519 cryptographically signed native desktop updater with automatic rollback protection.",
      ],
      installers: {
        macos: [
          {
            id: "macos-arm64-dmg",
            label: "macOS (Apple Silicon M1/M2/M3/M4)",
            arch: "aarch64",
            format: ".dmg",
            filename: `TwoolKit_${DESKTOP_RELEASE_VERSION}_aarch64.dmg`,
            sizeMB: 8.4,
            url: `${githubReleaseBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_aarch64.dmg`,
          },
          {
            id: "macos-x64-dmg",
            label: "macOS (Intel x86_64)",
            arch: "x86_64",
            format: ".dmg",
            filename: `TwoolKit_${DESKTOP_RELEASE_VERSION}_x64.dmg`,
            sizeMB: 8.9,
            url: `${githubReleaseBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_x64.dmg`,
          },
        ],
        windows: [
          {
            id: "windows-x64-exe",
            label: "Windows 11 / 10 (64-bit NSIS Installer)",
            arch: "x86_64",
            format: ".exe",
            filename: `TwoolKit_${DESKTOP_RELEASE_VERSION}_x64-setup.exe`,
            sizeMB: 6.2,
            url: `${githubReleaseBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_x64-setup.exe`,
          },
          {
            id: "windows-x64-msi",
            label: "Windows 11 / 10 (64-bit Enterprise MSI)",
            arch: "x86_64",
            format: ".msi",
            filename: `TwoolKit_${DESKTOP_RELEASE_VERSION}_x64_en-US.msi`,
            sizeMB: 7.1,
            url: `${githubReleaseBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_x64_en-US.msi`,
          },
          {
            id: "windows-arm64-exe",
            label: "Windows (ARM64 Installer)",
            arch: "aarch64",
            format: ".exe",
            filename: `TwoolKit_${DESKTOP_RELEASE_VERSION}_arm64-setup.exe`,
            sizeMB: 6.0,
            url: `${githubReleaseBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_arm64-setup.exe`,
          },
        ],
        linux: [
          {
            id: "linux-x64-appimage",
            label: "Linux AppImage (Universal x86_64 · Auto-Update Enabled)",
            arch: "x86_64",
            format: ".AppImage",
            filename: `TwoolKit_${DESKTOP_RELEASE_VERSION}_amd64.AppImage`,
            sizeMB: 74.5,
            url: `${githubReleaseBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_amd64.AppImage`,
          },
          {
            id: "linux-x64-deb",
            label: "Ubuntu / Debian Package (amd64 .deb)",
            arch: "x86_64",
            format: ".deb",
            filename: `TwoolKit_${DESKTOP_RELEASE_VERSION}_amd64.deb`,
            sizeMB: 8.1,
            url: `${githubReleaseBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_amd64.deb`,
          },
          {
            id: "linux-x64-rpm",
            label: "Fedora / RHEL Package (x86_64 .rpm)",
            arch: "x86_64",
            format: ".rpm",
            filename: `TwoolKit-${DESKTOP_RELEASE_VERSION}-1.x86_64.rpm`,
            sizeMB: 8.2,
            url: `${githubReleaseBase}/TwoolKit-${DESKTOP_RELEASE_VERSION}-1.x86_64.rpm`,
          },
        ],
      },
    },
    { headers: CORS_HEADERS }
  );
}
