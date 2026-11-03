/**
 * Client-Side File Scanning & Analysis Engine.
 *
 * Implements real cryptographic hashing (SHA-256), perceptual image hashing (dHash),
 * magic byte signature verification, suspicious anomaly detection,
 * file categorization, duplicate detection, and large file analysis.
 */

import {
  categoryOf,
  detectSignature,
  expectedTypesForExt,
  extOf,
  readHead,
  type Category,
  type Signature,
} from "./fileTypes";
import { sha256 as hashWasmSha256 } from "hash-wasm";

export interface ScannedFile {
  id: string;
  name: string;
  path: string; // relative path within folder or filename
  size: number;
  lastModified: number;
  category: Category;
  extension: string;
  claimedMime: string;
  detectedSignature: Signature | null;
  sha256?: string;
  perceptualHash?: string; // For images: 64-bit difference hash
  suspiciousFindings: SuspiciousFinding[];
  isCorrupted: boolean;
  fileRef?: File | Blob;
}

export interface SuspiciousFinding {
  level: "danger" | "warning" | "info";
  title: string;
  detail: string;
}

export interface DuplicateGroup {
  id: string;
  type: "exact" | "similar_image" | "same_name_diff_content";
  hash?: string;
  files: ScannedFile[];
  totalWastedBytes: number; // (count - 1) * file.size
  recommendedKeepId: string; // ID of the one to keep (e.g. newest or cleanest path)
}

export interface ScanResult {
  files: ScannedFile[];
  folders: string[];
  totalBytes: number;
  categoryBytes: Record<Category, number>;
  categoryCounts: Record<Category, number>;
  duplicateGroups: DuplicateGroup[];
  largeFiles: ScannedFile[]; // files > 10MB or top 10%
  suspiciousFiles: ScannedFile[];
  scannedAt: number;
}

/** Check if Web Crypto is available; fallback to hash-wasm. */
export async function calculateSha256(blob: Blob): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle && blob.size < 100 * 1024 * 1024) {
    try {
      const buffer = await blob.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(digest));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fall through to hash-wasm
    }
  }
  // For larger files or environments without crypto.subtle
  const buffer = new Uint8Array(await blob.arrayBuffer());
  return hashWasmSha256(buffer);
}

/**
 * 64-bit difference hash (dHash) for images.
 * Resizes image to 9x8 grayscale, then compares adjacent pixels (left > right).
 */
export async function calculatePerceptualHash(blob: Blob): Promise<string | null> {
  const fileName = (blob as File).name || "";
  if (!blob.type.startsWith("image/") && !["jpg", "jpeg", "png", "webp", "bmp"].includes(extOf(fileName))) {
    return null;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.crossOrigin = "anonymous";
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 9;
        canvas.height = 8;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);

        ctx.drawImage(img, 0, 0, 9, 8);
        const data = ctx.getImageData(0, 0, 9, 8).data;
        // Convert to grayscale: 0.299R + 0.587G + 0.114B
        const gray: number[] = [];
        for (let i = 0; i < data.length; i += 4) {
          gray.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        }

        // Compare adjacent pixels on each row: (9 columns -> 8 differences per row -> 64 bits)
        let hash = "";
        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const left = gray[row * 9 + col];
            const right = gray[row * 9 + col + 1];
            hash += left > right ? "1" : "0";
          }
        }
        // Convert binary string to 16 hex chars
        let hex = "";
        for (let i = 0; i < hash.length; i += 4) {
          hex += parseInt(hash.slice(i, i + 4), 2).toString(16);
        }
        resolve(hex);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** Calculate Hamming distance between two 16-char hex perceptual hashes (0 to 64). */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 64;
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    const v1 = parseInt(hash1[i], 16);
    const v2 = parseInt(hash2[i], 16);
    let xor = v1 ^ v2;
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

const EXECUTABLE_TYPES = new Set(["exe", "elf", "macho"]);
const DANGEROUS_EXTS = new Set(["exe", "bat", "cmd", "sh", "vbs", "ps1", "scr", "pif", "com", "jar"]);

/** Inspect a file for suspicious characteristics or signature mismatch. */
export function analyzeSuspiciousCharacteristics(
  name: string,
  size: number,
  sig: Signature | null
): SuspiciousFinding[] {
  const findings: SuspiciousFinding[] = [];
  const ext = extOf(name);

  // 1. Double extension check (e.g. document.pdf.exe or invoice.docx.js)
  const parts = name.split(".");
  if (parts.length > 2) {
    const penult = parts[parts.length - 2].toLowerCase();
    if (["pdf", "docx", "xlsx", "pptx", "jpg", "png", "zip"].includes(penult) && DANGEROUS_EXTS.has(ext)) {
      findings.push({
        level: "danger",
        title: "Disguised Double Extension",
        detail: `The file appears disguised as a '${penult.toUpperCase()}' document but executes as '.${ext}'.`,
      });
    }
  }

  // 2. Right-to-Left Override (RTLO) or zero-width character spoofing
  if (/[\u202E\u202B\u200B\uFEFF]/.test(name)) {
    findings.push({
      level: "danger",
      title: "Bi-directional Override Detected",
      detail: "The filename contains hidden directional unicode characters commonly used to spoof file extensions.",
    });
  }

  // 3. Executable header disguised with non-executable extension
  if (sig && EXECUTABLE_TYPES.has(sig.type) && !DANGEROUS_EXTS.has(ext)) {
    findings.push({
      level: "danger",
      title: "Hidden Executable Binary",
      detail: `File signature indicates an executable (${sig.label}), but the extension is .${ext || "none"}.`,
    });
  }

  // 4. Extension / MIME Signature Mismatch
  if (sig && ext) {
    const expected = expectedTypesForExt(ext);
    if (expected && !expected.includes(sig.type)) {
      findings.push({
        level: "warning",
        title: "File Signature Mismatch",
        detail: `File extension is .${ext}, but content magic bytes match ${sig.label} (${sig.type}).`,
      });
    }
  }

  // 5. Zero-byte or empty file
  if (size === 0) {
    findings.push({
      level: "info",
      title: "Empty File",
      detail: "This file has 0 bytes of content.",
    });
  }

  // 6. Macro-enabled office document
  if (["docm", "xlsm", "pptm"].includes(ext)) {
    findings.push({
      level: "info",
      title: "Macro-Enabled Document",
      detail: `Contains embedded VBA macros (${ext.toUpperCase()}).`,
    });
  }

  return findings;
}

/** Analyze a single file in browser memory. */
export async function analyzeFile(
  file: File | Blob,
  path?: string
): Promise<ScannedFile> {
  const name = (file as File).name || path || "unnamed";
  const size = file.size;
  const lastModified = (file as File).lastModified || Date.now();
  const extension = extOf(name);
  const category = categoryOf(name);
  const claimedMime = file.type || "application/octet-stream";

  // Read header for signature
  const head = await readHead(file, 4096);
  const detectedSignature = detectSignature(head);

  // Calculate SHA-256
  const sha256 = await calculateSha256(file);

  // Perceptual hash if image
  let perceptualHash: string | undefined;
  if (category === "image") {
    const ph = await calculatePerceptualHash(file);
    if (ph) perceptualHash = ph;
  }

  const suspiciousFindings = analyzeSuspiciousCharacteristics(name, size, detectedSignature);
  const isCorrupted = size > 0 && !detectedSignature && ["pdf", "png", "jpeg", "docx", "xlsx", "zip"].includes(extension);

  return {
    id: `${name}_${size}_${lastModified}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    path: path || name,
    size,
    lastModified,
    category,
    extension,
    claimedMime,
    detectedSignature,
    sha256,
    perceptualHash,
    suspiciousFindings,
    isCorrupted,
    fileRef: file,
  };
}

/**
 * Perform complete scan on a collection of scanned files:
 * builds category breakdown, exact duplicates, perceptual similar images,
 * same-name different-content anomalies, and large file ranking.
 */
export function summarizeScan(scannedFiles: ScannedFile[]): ScanResult {
  const folders = new Set<string>();
  let totalBytes = 0;
  const categoryBytes: Record<Category, number> = {
    pdf: 0,
    document: 0,
    presentation: 0,
    spreadsheet: 0,
    image: 0,
    video: 0,
    audio: 0,
    archive: 0,
    code: 0,
    other: 0,
  };
  const categoryCounts: Record<Category, number> = {
    pdf: 0,
    document: 0,
    presentation: 0,
    spreadsheet: 0,
    image: 0,
    video: 0,
    audio: 0,
    archive: 0,
    code: 0,
    other: 0,
  };

  const bySha = new Map<string, ScannedFile[]>();
  const byName = new Map<string, ScannedFile[]>();
  const imageFiles: ScannedFile[] = [];
  const suspiciousFiles: ScannedFile[] = [];

  for (const f of scannedFiles) {
    totalBytes += f.size;
    categoryBytes[f.category] = (categoryBytes[f.category] || 0) + f.size;
    categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;

    // Folder extraction
    const slashIdx = f.path.lastIndexOf("/");
    if (slashIdx > 0) {
      folders.add(f.path.slice(0, slashIdx));
    }

    // Exact hash grouping
    if (f.sha256 && f.size > 0) {
      const list = bySha.get(f.sha256) || [];
      list.push(f);
      bySha.set(f.sha256, list);
    }

    // Name grouping
    const lowerName = f.name.toLowerCase();
    const nameList = byName.get(lowerName) || [];
    nameList.push(f);
    byName.set(lowerName, nameList);

    // Images for pHash
    if (f.perceptualHash) {
      imageFiles.push(f);
    }

    if (f.suspiciousFindings.length > 0 || f.isCorrupted) {
      suspiciousFiles.push(f);
    }
  }

  // Duplicate groups
  const duplicateGroups: DuplicateGroup[] = [];

  // 1. Exact duplicates by SHA-256
  for (const [hash, group] of bySha.entries()) {
    if (group.length > 1) {
      // Pick best file to keep: newest modified, or shortest path
      const sorted = [...group].sort((a, b) => b.lastModified - a.lastModified || a.path.length - b.path.length);
      const keep = sorted[0];
      const wasted = (group.length - 1) * group[0].size;
      duplicateGroups.push({
        id: `exact_${hash.slice(0, 12)}`,
        type: "exact",
        hash,
        files: group,
        totalWastedBytes: wasted,
        recommendedKeepId: keep.id,
      });
    }
  }

  // 2. Same name, different content
  for (const [name, group] of byName.entries()) {
    if (group.length > 1) {
      const distinctHashes = new Set(group.map((g) => g.sha256).filter(Boolean));
      if (distinctHashes.size > 1) {
        // Group has identical name but differing contents
        const sorted = [...group].sort((a, b) => b.lastModified - a.lastModified);
        duplicateGroups.push({
          id: `name_conflict_${name}`,
          type: "same_name_diff_content",
          files: group,
          totalWastedBytes: 0,
          recommendedKeepId: sorted[0].id,
        });
      }
    }
  }

  // 3. Perceptually similar images (Hamming distance <= 6, not already identical SHA-256)
  const processedPairs = new Set<string>();
  for (let i = 0; i < imageFiles.length; i++) {
    for (let j = i + 1; j < imageFiles.length; j++) {
      const f1 = imageFiles[i];
      const f2 = imageFiles[j];
      if (f1.sha256 && f2.sha256 && f1.sha256 === f2.sha256) continue; // Already exact duplicate

      if (f1.perceptualHash && f2.perceptualHash) {
        const dist = hammingDistance(f1.perceptualHash, f2.perceptualHash);
        if (dist <= 6) {
          const key = [f1.id, f2.id].sort().join("::");
          if (!processedPairs.has(key)) {
            processedPairs.add(key);
            const keep = f1.size >= f2.size ? f1 : f2; // Keep higher resolution/size
            duplicateGroups.push({
              id: `similar_${f1.id.slice(0, 6)}_${f2.id.slice(0, 6)}`,
              type: "similar_image",
              files: [f1, f2],
              totalWastedBytes: Math.min(f1.size, f2.size),
              recommendedKeepId: keep.id,
            });
          }
        }
      }
    }
  }

  // Sort large files descending by size
  const largeFiles = [...scannedFiles]
    .filter((f) => f.size >= 5 * 1024 * 1024) // >= 5 MB
    .sort((a, b) => b.size - a.size);

  return {
    files: scannedFiles,
    folders: Array.from(folders),
    totalBytes,
    categoryBytes,
    categoryCounts,
    duplicateGroups,
    largeFiles,
    suspiciousFiles,
    scannedAt: Date.now(),
  };
}
