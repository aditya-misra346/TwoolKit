import { NextResponse } from "next/server";

export const DESKTOP_RELEASE_VERSION = "1.2.0";
export const MIN_REQUIRED_DESKTOP_VERSION = "1.0.0";
export const RELEASE_DATE = "2026-11-05";

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
    "6c65a6c";

  const githubReleaseBase = `https://github.com/aditya-misra346/TwoolKit/releases/download/desktop-v${DESKTOP_RELEASE_VERSION}`;
  const githubLatestBase = "https://github.com/aditya-misra346/TwoolKit/releases/latest/download";

  return NextResponse.json(
    {
      product: "TwoolKit Desktop",
      appVersion: DESKTOP_RELEASE_VERSION,
      gitSha,
      buildTimestamp: new Date().toISOString(),
      releaseDate: RELEASE_DATE,
      minDesktopVersion: MIN_REQUIRED_DESKTOP_VERSION,
      canonicalOrigin: "https://twoolkit.vercel.app",
      releasePageUrl: `https://github.com/aditya-misra346/TwoolKit/releases/tag/desktop-v${DESKTOP_RELEASE_VERSION}`,
      checksumsUrl: `${githubReleaseBase}/SHA256SUMS.txt`,
      updaterManifestUrl: `${githubLatestBase}/latest.json`,
      channels: {
        stable: {
          version: DESKTOP_RELEASE_VERSION,
          gitSha,
          minDesktopVersion: MIN_REQUIRED_DESKTOP_VERSION,
          publishedAt: `${RELEASE_DATE}T07:48:00Z`,
        },
        beta: {
          version: `${DESKTOP_RELEASE_VERSION}-beta.1`,
          gitSha,
          minDesktopVersion: MIN_REQUIRED_DESKTOP_VERSION,
          publishedAt: `${RELEASE_DATE}T07:48:00Z`,
        },
      },
      releaseNotes: [
        "Verified Windows 11 / 10 (64-bit x86_64) NSIS Installer (TwoolKit_1.2.0_x64-setup.exe) and Portable ZIP package with automatic WebView2 bootstrapping.",
        "Unified Tauri 2 + Rust native desktop runtime for Windows and macOS (Apple Silicon aarch64 & Intel x86_64).",
        "Automatic live website synchronization with https://twoolkit.vercel.app without full reinstallation.",
        "Scoped native filesystem integration: native Open/Save dialogs, recursive folder scanning with SHA-256 hashing, and direct output saving.",
        "Multi-view interactive storage analytics (Donut, Pie, and Bar charts) and 48 built-in PDF, Document, Presentation, Image, and Security tools.",
        "Ed25519 cryptographically signed native desktop updater (latest.json) with SHA-256 checksum verification.",
      ],
      installers: {
        macos: [
          {
            id: "macos-arm64-dmg",
            label: "macOS (Apple Silicon M1/M2/M3/M4)",
            arch: "aarch64",
            format: ".dmg",
            filename: `TwoolKit_${DESKTOP_RELEASE_VERSION}_aarch64.dmg`,
            sizeMB: 6.3,
            sha256: "3bd7382a1b8fdbdc6e472b6a0612e3b6c64d7c6fbf91fd1503b1ce0499c880de",
            verified: true,
            url: `${githubReleaseBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_aarch64.dmg`,
            latestUrl: `${githubLatestBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_aarch64.dmg`,
          },
          {
            id: "macos-x64-dmg",
            label: "macOS (Intel x86_64)",
            arch: "x86_64",
            format: ".dmg",
            filename: `TwoolKit_${DESKTOP_RELEASE_VERSION}_x64.dmg`,
            sizeMB: 6.8,
            sha256: "ec45291f3bd62585c376b9d00471a05fceff8292be31efd303c84fd7182edbd4",
            verified: true,
            url: `${githubReleaseBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_x64.dmg`,
            latestUrl: `${githubLatestBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_x64.dmg`,
          },
        ],
        windows: [
          {
            id: "windows-x64-exe",
            label: "Windows 11 / 10 (64-bit NSIS Installer)",
            arch: "x86_64",
            format: ".exe",
            filename: `TwoolKit_${DESKTOP_RELEASE_VERSION}_x64-setup.exe`,
            sizeMB: 6.4,
            sha256: "275cd7b336fecbb8f036263eb00994288032e22de44e57f759b29aa59afeb3fa",
            verified: true,
            url: `${githubReleaseBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_x64-setup.exe`,
            latestUrl: `${githubLatestBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_x64-setup.exe`,
          },
          {
            id: "windows-x64-portable",
            label: "Windows 11 / 10 (64-bit Portable ZIP — No Install Required)",
            arch: "x86_64",
            format: ".zip",
            filename: `TwoolKit_${DESKTOP_RELEASE_VERSION}_x64-portable.zip`,
            sizeMB: 9.2,
            sha256: "5d4cae6809582b854a5f41df5406e31ba4ea2e9ca0dd7effd7944a72736fa30e",
            verified: true,
            url: `${githubReleaseBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_x64-portable.zip`,
            latestUrl: `${githubLatestBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_x64-portable.zip`,
          },
          {
            id: "windows-arm64-compat",
            label: "Windows on ARM (Snapdragon X / ARM64 via x64 Installer)",
            arch: "aarch64",
            format: ".exe",
            filename: `TwoolKit_${DESKTOP_RELEASE_VERSION}_x64-setup.exe`,
            sizeMB: 6.4,
            sha256: "275cd7b336fecbb8f036263eb00994288032e22de44e57f759b29aa59afeb3fa",
            verified: true,
            url: `${githubReleaseBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_x64-setup.exe`,
            latestUrl: `${githubLatestBase}/TwoolKit_${DESKTOP_RELEASE_VERSION}_x64-setup.exe`,
          },
        ],
        linux: [],
      },
    },
    { headers: CORS_HEADERS }
  );
}
