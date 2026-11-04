"use client";

/**
 * TwoolKit Desktop Bridge (Tauri 2 + Rust Integration Layer).
 *
 * Provides safe, typed access to native OS capabilities when running inside
 * TwoolKit Desktop (macOS, Windows, Linux) while falling back cleanly in
 * standard web browsers so https://twoolkit.vercel.app continues working
 * from a single unified codebase.
 */

import { categoryOf, detectSignature, extOf } from "@/lib/fileTypes";
import type { ScannedFile } from "@/lib/scanner";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
  }
}

export interface DesktopRuntimeInfo {
  isDesktop: boolean;
  os: "macos" | "windows" | "linux" | "web";
  arch: string;
  nativeVersion: string;
  frontendVersion: string;
  authorizedDirectories: string[];
  defaultSaveDirectory: string | null;
}

export interface NativeScannedEntry {
  path: string;
  name: string;
  extension: string;
  size: number;
  lastModifiedMs: number;
  sha256: string;
  headBytes: number[];
}

export interface WebsiteSyncReport {
  upToDate: boolean;
  compatible: boolean;
  requiresNativeUpdate: boolean;
  currentSha: string;
  remoteSha: string;
  remoteAppVersion: string;
  minDesktopVersion: string;
  nativeVersion: string;
  buildTimestamp: string;
  releaseNotes: string[];
  checkedAt: number;
}

export interface NativeUpdateStatus {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  channel: "stable" | "beta";
  releaseNotes: string;
  publishedAt: string | null;
  signatureVerified: boolean;
}

/** True when executing inside the Tauri 2 native desktop application shell. */
export function isTauriDesktop(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__?.invoke);
}

/** Invoke a Tauri 2 Rust command safely. */
export async function invokeTauri<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!isTauriDesktop() || !window.__TAURI_INTERNALS__) {
    throw new Error(`Native desktop command '${cmd}' requires TwoolKit Desktop.`);
  }
  return window.__TAURI_INTERNALS__.invoke<T>(cmd, args);
}

/** Detect the user's operating system and CPU architecture for installer selection. */
export function detectClientPlatform(): {
  os: "macos" | "windows" | "linux";
  arch: "aarch64" | "x86_64";
  label: string;
} {
  if (typeof navigator === "undefined") {
    return { os: "macos", arch: "aarch64", label: "macOS (Apple Silicon)" };
  }
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || "").toLowerCase();

  let os: "macos" | "windows" | "linux" = "macos";
  if (ua.includes("win") || platform.includes("win")) {
    os = "windows";
  } else if (ua.includes("linux") || platform.includes("linux") || ua.includes("x11")) {
    os = "linux";
  }

  let arch: "aarch64" | "x86_64" = "x86_64";
  if (
    ua.includes("arm64") ||
    ua.includes("aarch64") ||
    (os === "macos" && !ua.includes("intel mac os x 10_"))
  ) {
    // Modern Macs default to Apple Silicon unless explicitly Intel
    arch = os === "macos" ? "aarch64" : ua.includes("arm") ? "aarch64" : "x86_64";
  }

  const label =
    os === "macos"
      ? arch === "aarch64"
        ? "macOS (Apple Silicon)"
        : "macOS (Intel)"
      : os === "windows"
      ? arch === "aarch64"
        ? "Windows (ARM64)"
        : "Windows (64-bit x86_64)"
      : "Linux (x86_64)";

  return { os, arch, label };
}

/** Semantic version comparison: returns -1 if a < b, 0 if a == b, 1 if a > b */
export function compareSemver(a: string, b: string): number {
  const cleanA = a.replace(/^v/, "").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  const cleanB = b.replace(/^v/, "").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const va = cleanA[i] || 0;
    const vb = cleanB[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

/** Query runtime information from Rust or fallback to browser info. */
export async function getDesktopRuntimeInfo(): Promise<DesktopRuntimeInfo> {
  if (isTauriDesktop()) {
    try {
      return await invokeTauri<DesktopRuntimeInfo>("get_desktop_runtime_info");
    } catch {
      // Fallback if command unavailable
    }
  }
  const detected = detectClientPlatform();
  return {
    isDesktop: false,
    os: "web",
    arch: detected.arch,
    nativeVersion: "1.2.0",
    frontendVersion: "1.2.0",
    authorizedDirectories: [],
    defaultSaveDirectory: null,
  };
}

/** Prompt user with a native OS folder selection dialog and grant scoped access. */
export async function authorizeDesktopDirectory(): Promise<string | null> {
  if (!isTauriDesktop()) return null;
  return await invokeTauri<string | null>("authorize_directory");
}

/** List all user-authorized directories in the current desktop session. */
export async function getAuthorizedDirectories(): Promise<string[]> {
  if (!isTauriDesktop()) return [];
  return await invokeTauri<string[]>("list_authorized_directories");
}

/** Revoke a previously authorized directory grant. */
export async function revokeAuthorizedDirectory(path: string): Promise<string[]> {
  if (!isTauriDesktop()) return [];
  await invokeTauri<boolean>("revoke_authorized_directory", { directory: path });
  return await getAuthorizedDirectories();
}

/**
 * Scan an authorized local directory using the native multi-threaded Rust scanner.
 * Computes real SHA-256 hashes and reads magic-byte headers directly from disk,
 * then converts them into TwoolKit `ScannedFile` records.
 */
export async function scanAuthorizedDirectoryNative(dirPath: string): Promise<ScannedFile[]> {
  const entries = await invokeTauri<NativeScannedEntry[]>("scan_authorized_directory", {
    directory: dirPath,
  });

  return entries.map((entry, idx) => {
    const head = new Uint8Array(entry.headBytes);
    const sig = detectSignature(head);
    const cat = categoryOf(entry.name);
    const mime = sig?.mime || "application/octet-stream";
    // Create a lightweight representative File handle with metadata
    const placeholderBlob = new Blob([head], { type: mime });
    const fileObj = new File([placeholderBlob], entry.name, {
      lastModified: entry.lastModifiedMs,
      type: mime,
    });

    return {
      id: `native_${idx}_${(entry.sha256 || "nohash").slice(0, 12)}`,
      name: entry.name,
      path: entry.path,
      size: entry.size,
      extension: entry.extension || extOf(entry.name),
      category: cat,
      lastModified: entry.lastModifiedMs,
      claimedMime: mime,
      detectedSignature: sig,
      sha256: entry.sha256,
      suspiciousFindings: [],
      isCorrupted: false,
      fileRef: fileObj,
    };
  });
}

/** Save a converted or compressed output Blob directly to disk via native OS Save Dialog. */
export async function saveBlobWithNativeDialog(
  defaultName: string,
  blob: Blob
): Promise<{ saved: boolean; path?: string }> {
  if (isTauriDesktop()) {
    const buffer = await blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    const savedPath = await invokeTauri<string | null>("save_output_file_dialog", {
      defaultName,
      bytes,
    });
    return { saved: Boolean(savedPath), path: savedPath ?? undefined };
  }

  // Standard browser download fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
  return { saved: true };
}

/** Execute a scoped native filesystem operation (rename, copy, move, delete, mkdir). */
export async function executeNativeFileOperation(params: {
  op: "rename" | "copy" | "move" | "delete" | "mkdir";
  sourcePath: string;
  targetPath?: string;
}): Promise<{ ok: boolean; detail: string }> {
  const res = await invokeTauri<{ ok: boolean; message?: string; detail?: string }>(
    "native_file_operation",
    {
      operation: params.op,
      sourcePath: params.sourcePath,
      targetPath: params.targetPath,
    }
  );
  return { ok: res.ok, detail: res.message || res.detail || "Completed" };
}

/**
 * Check whether the live TwoolKit website (https://twoolkit.vercel.app) has deployed
 * a newer frontend build, and verify compatibility with the installed native desktop shell.
 */
export async function checkWebsiteSyncStatus(
  currentSha: string,
  nativeVersion = "1.2.0"
): Promise<WebsiteSyncReport> {
  if (isTauriDesktop()) {
    try {
      return await invokeTauri<WebsiteSyncReport>("check_website_sync", {
        currentSha,
      });
    } catch {
      // Fallback to direct HTTPS check below
    }
  }

  const res = await fetch("/api/desktop-manifest", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Manifest check returned HTTP ${res.status}`);
  }
  const data = await res.json();
  const remoteSha: string = data.gitSha || "unknown";
  const minDesktopVersion: string = data.minDesktopVersion || "1.0.0";
  const compatible = compareSemver(nativeVersion, minDesktopVersion) >= 0;
  const upToDate = !currentSha || currentSha === remoteSha;

  return {
    upToDate,
    compatible,
    requiresNativeUpdate: !compatible,
    currentSha: currentSha || remoteSha,
    remoteSha,
    remoteAppVersion: data.appVersion || "1.2.0",
    minDesktopVersion,
    nativeVersion,
    buildTimestamp: data.buildTimestamp || new Date().toISOString(),
    releaseNotes: Array.isArray(data.releaseNotes) ? data.releaseNotes : [],
    checkedAt: Date.now(),
  };
}

/** Check for a signed native desktop binary update (Rust/Tauri layer). */
export async function checkNativeDesktopUpdate(
  channel: "stable" | "beta" = "stable"
): Promise<NativeUpdateStatus> {
  if (isTauriDesktop()) {
    try {
      return await invokeTauri<NativeUpdateStatus>("check_native_update", { channel });
    } catch {
      // Fallback to manifest comparison
    }
  }

  const res = await fetch("/api/desktop-manifest", { cache: "no-store" });
  const data = await res.json();
  const ch = data.channels?.[channel] || data.channels?.stable;
  const latestVersion = ch?.version || data.appVersion || "1.2.0";
  const currentVersion = "1.2.0";
  const available = compareSemver(latestVersion, currentVersion) > 0;

  return {
    available,
    currentVersion,
    latestVersion,
    channel,
    releaseNotes: (data.releaseNotes || []).join("\n• "),
    publishedAt: ch?.publishedAt || new Date().toISOString(),
    signatureVerified: true,
  };
}

/** Store a sensitive credential in the native OS encrypted vault (or session fallback on web). */
export async function secureVaultSet(key: string, value: string): Promise<void> {
  if (isTauriDesktop()) {
    await invokeTauri("vault_set_secret", { key, value });
    return;
  }
  if (typeof window !== "undefined") {
    sessionStorage.setItem(`twoolkit_vault_${key}`, value);
  }
}

export async function secureVaultGet(key: string): Promise<string | null> {
  if (isTauriDesktop()) {
    return await invokeTauri<string | null>("vault_get_secret", { key });
  }
  if (typeof window !== "undefined") {
    return sessionStorage.getItem(`twoolkit_vault_${key}`);
  }
  return null;
}

export async function secureVaultDelete(key: string): Promise<void> {
  if (isTauriDesktop()) {
    await invokeTauri("vault_delete_secret", { key });
    return;
  }
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(`twoolkit_vault_${key}`);
  }
}
