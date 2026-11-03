/**
 * Client-Side ZIP Archive Creation and Safe Extraction using JSZip.
 * Includes strict Zip-Slip / Path Traversal protection.
 */

import JSZip from "jszip";

export interface ZipEntry {
  path: string;
  name: string;
  size: number;
  isDir: boolean;
  date: Date;
}

/** Sanitize an archive entry path to prevent Zip-Slip / Directory Traversal attacks */
export function sanitizeZipPath(rawPath: string): string | null {
  // Replace backslashes with slashes
  let clean = rawPath.replace(/\\/g, "/");

  // Disallow absolute paths
  if (clean.startsWith("/")) clean = clean.slice(1);

  // Normalize segments
  const segments = clean.split("/").filter(Boolean);
  const safeSegments: string[] = [];

  for (const seg of segments) {
    if (seg === ".") continue;
    if (seg === "..") {
      // Trying to climb out of parent directory!
      return null;
    }
    // Remove control characters or forbidden chars
    const safeName = seg.replace(/[\x00-\x1f\x7f:*?"<>|]/g, "_").trim();
    if (safeName) safeSegments.push(safeName);
  }

  if (safeSegments.length === 0) return null;
  return safeSegments.join("/");
}

/** Inspect entries of a ZIP file safely */
export async function inspectZip(blob: Blob): Promise<ZipEntry[]> {
  const zip = await JSZip.loadAsync(blob);
  const entries: ZipEntry[] = [];

  zip.forEach((relativePath, file) => {
    const safePath = sanitizeZipPath(relativePath);
    if (!safePath) return; // Skip unsafe entry
    entries.push({
      path: safePath,
      name: safePath.split("/").pop() || safePath,
      size: (file as any)._data?.uncompressedSize || 0,
      isDir: file.dir,
      date: file.date,
    });
  });

  return entries;
}

/** Safely extract files from a ZIP archive */
export async function extractZip(
  blob: Blob,
  onProgress?: (progress: number, stage: string) => void
): Promise<{ path: string; name: string; blob: Blob }[]> {
  onProgress?.(0.1, "Reading archive index");
  const zip = await JSZip.loadAsync(blob);
  const extracted: { path: string; name: string; blob: Blob }[] = [];

  const fileKeys: string[] = [];
  zip.forEach((path, file) => {
    if (!file.dir) fileKeys.push(path);
  });

  const total = fileKeys.length;
  for (let i = 0; i < total; i++) {
    const rawPath = fileKeys[i];
    const safePath = sanitizeZipPath(rawPath);
    if (!safePath) continue; // Prevent Zip-Slip

    const entry = zip.file(rawPath);
    if (!entry) continue;

    onProgress?.(0.1 + 0.85 * (i / total), `Extracting ${safePath}`);
    const u8 = await entry.async("uint8array");
    const filename = safePath.split("/").pop() || "file";
    extracted.push({
      path: safePath,
      name: filename,
      blob: new Blob([u8 as BlobPart]),
    });
  }

  onProgress?.(1.0, "Extraction complete");
  return extracted;
}

/** Create a ZIP archive from a list of files with optional directory structure */
export async function createZip(
  files: { name: string; path?: string; blob: Blob }[],
  compressionLevel: "STORE" | "DEFLATE" = "DEFLATE",
  onProgress?: (progress: number, stage: string) => void
): Promise<Blob> {
  const zip = new JSZip();
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const f = files[i];
    onProgress?.(0.1 + 0.8 * (i / total), `Packing ${f.name}`);
    const filePath = f.path ? sanitizeZipPath(f.path) || f.name : f.name;
    const buf = await f.blob.arrayBuffer();
    zip.file(filePath, buf);
  }

  onProgress?.(0.9, "Compressing archive");
  const result = await zip.generateAsync(
    {
      type: "blob",
      compression: compressionLevel,
      compressionOptions: { level: compressionLevel === "DEFLATE" ? 6 : 0 },
    },
    (metadata) => {
      onProgress?.(0.9 + 0.1 * (metadata.percent / 100), `Compressing: ${Math.round(metadata.percent)}%`);
    }
  );

  return result;
}
