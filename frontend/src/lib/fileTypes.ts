/**
 * File-type knowledge base: extension → category, magic-byte signature detection,
 * and helpers for human-readable sizes. Used by the scanner, dashboard and
 * every tool's upload validation.
 */

export type Category =
  | "pdf"
  | "document"
  | "presentation"
  | "spreadsheet"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "other";

/** Storage-overview buckets requested for the dashboard. */
export type StorageBucket =
  | "documents"
  | "pdfs"
  | "images"
  | "presentations"
  | "videos"
  | "audio"
  | "archives"
  | "other";

export const CATEGORY_LABEL: Record<Category, string> = {
  pdf: "PDF",
  document: "Word & text",
  presentation: "Presentations",
  spreadsheet: "Spreadsheets",
  image: "Images",
  video: "Videos",
  audio: "Audio",
  archive: "Archives",
  code: "Code",
  other: "Other",
};

export const BUCKET_LABEL: Record<StorageBucket, string> = {
  documents: "Documents",
  pdfs: "PDFs",
  images: "Images",
  presentations: "Presentations",
  videos: "Videos",
  audio: "Audio",
  archives: "Archives",
  other: "Other",
};

/** Chart colours (CSS variables defined in globals.css). */
export const BUCKET_COLOR: Record<StorageBucket, string> = {
  documents: "var(--c-docs)",
  pdfs: "var(--c-pdf)",
  images: "var(--c-images)",
  presentations: "var(--c-slides)",
  videos: "var(--c-videos)",
  audio: "var(--c-audio)",
  archives: "var(--c-archives)",
  other: "var(--c-other)",
};

export const CATEGORY_COLOR: Record<Category, string> = {
  pdf: "var(--c-pdf)",
  document: "var(--c-docs)",
  presentation: "var(--c-slides)",
  spreadsheet: "var(--c-sheets)",
  image: "var(--c-images)",
  video: "var(--c-videos)",
  audio: "var(--c-audio)",
  archive: "var(--c-archives)",
  code: "var(--c-code)",
  other: "var(--c-other)",
};

const EXT_CATEGORY: Record<string, Category> = {};
const reg = (cat: Category, exts: string) =>
  exts.split(" ").forEach((e) => (EXT_CATEGORY[e] = cat));

reg("pdf", "pdf");
reg("document", "doc docx docm odt rtf txt md markdown pages tex wpd");
reg("presentation", "ppt pptx pptm odp key pps ppsx");
reg("spreadsheet", "xls xlsx xlsm ods csv tsv numbers");
reg("image", "jpg jpeg png webp avif gif bmp tif tiff ico svg heic heif jfif psd raw cr2 nef dng arw");
reg("video", "mp4 mov m4v mkv webm avi wmv flv mpeg mpg 3gp");
reg("audio", "mp3 wav flac aac m4a ogg oga opus wma aiff aif");
reg("archive", "zip rar 7z tar gz tgz bz2 xz zst dmg iso");
reg(
  "code",
  "js mjs cjs ts tsx jsx py rb go rs java kt swift c h cpp hpp cs php html htm css scss json xml yml yaml toml sh bash zsh sql ipynb vue svelte lua r dart"
);

export function extOf(name: string): string {
  const base = name.split("/").pop() ?? name;
  const i = base.lastIndexOf(".");
  if (i <= 0 || i === base.length - 1) return "";
  return base.slice(i + 1).toLowerCase();
}

export function baseName(name: string): string {
  const b = name.split("/").pop() ?? name;
  const i = b.lastIndexOf(".");
  return i > 0 ? b.slice(0, i) : b;
}

export function categoryOf(name: string): Category {
  return EXT_CATEGORY[extOf(name)] ?? "other";
}

export function bucketOf(cat: Category): StorageBucket {
  switch (cat) {
    case "pdf":
      return "pdfs";
    case "document":
    case "spreadsheet":
    case "code":
      return "documents";
    case "presentation":
      return "presentations";
    case "image":
      return "images";
    case "video":
      return "videos";
    case "audio":
      return "audio";
    case "archive":
      return "archives";
    default:
      return "other";
  }
}

/* ------------------------------------------------------------------ */
/* Magic-byte signature detection                                      */
/* ------------------------------------------------------------------ */

export interface Signature {
  /** Canonical short type id, e.g. "pdf", "png", "zip", "docx". */
  type: string;
  mime: string;
  label: string;
}

const S = (type: string, mime: string, label: string): Signature => ({ type, mime, label });

function startsWith(b: Uint8Array, sig: number[], offset = 0) {
  if (b.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (b[offset + i] !== sig[i]) return false;
  return true;
}
function ascii(b: Uint8Array, start: number, len: number) {
  let s = "";
  for (let i = start; i < Math.min(b.length, start + len); i++) s += String.fromCharCode(b[i]);
  return s;
}

/**
 * Detect a file type from its first bytes (≥ 64 recommended, 4 KB ideal).
 * ZIP-based formats return "zip"; call {@link refineZip} with the entry list to
 * distinguish DOCX/XLSX/PPTX/ODF/JAR/EPUB.
 */
export function detectSignature(b: Uint8Array): Signature | null {
  if (b.length === 0) return null;
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46])) return S("pdf", "application/pdf", "PDF document");
  // PDFs may have junk before the header (allowed within first 1024 bytes)
  if (ascii(b, 0, 1024).includes("%PDF-")) return S("pdf", "application/pdf", "PDF document");
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return S("png", "image/png", "PNG image");
  if (startsWith(b, [0xff, 0xd8, 0xff])) return S("jpeg", "image/jpeg", "JPEG image");
  if (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a") return S("gif", "image/gif", "GIF image");
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return S("webp", "image/webp", "WebP image");
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") return S("wav", "audio/wav", "WAV audio");
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "AVI ") return S("avi", "video/x-msvideo", "AVI video");
  if (startsWith(b, [0x42, 0x4d]) && b.length > 14) return S("bmp", "image/bmp", "BMP image");
  if (startsWith(b, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, [0x4d, 0x4d, 0x00, 0x2a]))
    return S("tiff", "image/tiff", "TIFF image");
  if (startsWith(b, [0x00, 0x00, 0x01, 0x00])) return S("ico", "image/x-icon", "ICO icon");
  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    const brands = ascii(b, 8, 32);
    if (brand === "avif" || brand === "avis") return S("avif", "image/avif", "AVIF image");
    if (/heic|heix|hevc|hevx|heim|heis/.test(brand)) return S("heic", "image/heic", "HEIC image");
    if (brand === "mif1" || brand === "msf1") {
      if (brands.includes("avif")) return S("avif", "image/avif", "AVIF image");
      return S("heif", "image/heif", "HEIF image");
    }
    if (brand === "qt  ") return S("mov", "video/quicktime", "QuickTime video");
    if (/M4A |M4B /.test(brand)) return S("m4a", "audio/mp4", "MPEG-4 audio");
    return S("mp4", "video/mp4", "MPEG-4 video");
  }
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return S("mkv", "video/x-matroska", "Matroska/WebM video");
  if (ascii(b, 0, 3) === "ID3" || startsWith(b, [0xff, 0xfb]) || startsWith(b, [0xff, 0xf3]) || startsWith(b, [0xff, 0xf2]))
    return S("mp3", "audio/mpeg", "MP3 audio");
  if (ascii(b, 0, 4) === "fLaC") return S("flac", "audio/flac", "FLAC audio");
  if (ascii(b, 0, 4) === "OggS") return S("ogg", "audio/ogg", "Ogg media");
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06]))
    return S("zip", "application/zip", "ZIP archive");
  if (startsWith(b, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) return S("rar", "application/vnd.rar", "RAR archive");
  if (startsWith(b, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return S("7z", "application/x-7z-compressed", "7-Zip archive");
  if (startsWith(b, [0x1f, 0x8b])) return S("gz", "application/gzip", "GZIP archive");
  if (startsWith(b, [0x42, 0x5a, 0x68])) return S("bz2", "application/x-bzip2", "BZIP2 archive");
  if (startsWith(b, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])) return S("xz", "application/x-xz", "XZ archive");
  if (ascii(b, 257, 5) === "ustar") return S("tar", "application/x-tar", "TAR archive");
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    return S("ole", "application/x-ole-storage", "Legacy Office (OLE2) document");
  if (startsWith(b, [0x4d, 0x5a])) return S("exe", "application/x-msdownload", "Windows executable");
  if (startsWith(b, [0x7f, 0x45, 0x4c, 0x46])) return S("elf", "application/x-elf", "Linux executable");
  if (
    startsWith(b, [0xcf, 0xfa, 0xed, 0xfe]) ||
    startsWith(b, [0xce, 0xfa, 0xed, 0xfe]) ||
    startsWith(b, [0xca, 0xfe, 0xba, 0xbe])
  )
    return S("macho", "application/x-mach-binary", "macOS executable");
  if (ascii(b, 0, 5) === "{\\rtf") return S("rtf", "application/rtf", "Rich Text document");
  if (ascii(b, 0, 2) === "#!") return S("script", "text/x-shellscript", "Script with shebang");

  // Text-ish detection
  const head = ascii(b, 0, 512).replace(/^\uFEFF/, "").trimStart().toLowerCase();
  if (head.startsWith("<?xml")) {
    if (head.includes("<svg")) return S("svg", "image/svg+xml", "SVG image");
    return S("xml", "application/xml", "XML document");
  }
  if (head.startsWith("<svg")) return S("svg", "image/svg+xml", "SVG image");
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) return S("html", "text/html", "HTML document");
  if (isProbablyText(b)) return S("text", "text/plain", "Plain text");
  return null;
}

/** Heuristic: no NUL bytes and mostly printable / valid UTF-8 in the sample. */
export function isProbablyText(b: Uint8Array): boolean {
  const n = Math.min(b.length, 4096);
  if (n === 0) return true;
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const c = b[i];
    if (c === 0) return false;
    if (c < 9 || (c > 13 && c < 32)) bad++;
  }
  if (bad / n > 0.02) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(b.subarray(0, n - 4 > 0 ? n - 4 : n));
    return true;
  } catch {
    return bad === 0;
  }
}

/** Distinguish ZIP containers by their entries. */
export function refineZip(entries: string[]): Signature {
  const has = (p: string) => entries.includes(p);
  const any = (prefix: string) => entries.some((e) => e.startsWith(prefix));
  if (has("[Content_Types].xml")) {
    if (any("word/")) return S("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Word document");
    if (any("xl/")) return S("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Excel workbook");
    if (any("ppt/")) return S("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "PowerPoint presentation");
    return S("ooxml", "application/zip", "Office Open XML package");
  }
  if (has("mimetype")) {
    if (any("META-INF/container.xml")) return S("epub", "application/epub+zip", "EPUB e-book");
    return S("odf", "application/vnd.oasis.opendocument", "OpenDocument file");
  }
  if (has("META-INF/MANIFEST.MF")) return S("jar", "application/java-archive", "Java archive");
  return S("zip", "application/zip", "ZIP archive");
}

/** Which detected signature types are acceptable for a given extension. */
const EXT_EXPECT: Record<string, string[]> = {
  pdf: ["pdf"],
  png: ["png"],
  jpg: ["jpeg"],
  jpeg: ["jpeg"],
  jfif: ["jpeg"],
  gif: ["gif"],
  webp: ["webp"],
  bmp: ["bmp"],
  tif: ["tiff"],
  tiff: ["tiff"],
  ico: ["ico", "png"],
  avif: ["avif"],
  heic: ["heic", "heif"],
  heif: ["heif", "heic"],
  svg: ["svg", "xml", "text"],
  docx: ["docx", "zip", "ooxml"],
  docm: ["docx", "zip", "ooxml"],
  xlsx: ["xlsx", "zip", "ooxml"],
  xlsm: ["xlsx", "zip", "ooxml"],
  pptx: ["pptx", "zip", "ooxml"],
  pptm: ["pptx", "zip", "ooxml"],
  odt: ["odf", "zip"],
  ods: ["odf", "zip"],
  odp: ["odf", "zip"],
  epub: ["epub", "zip"],
  doc: ["ole", "rtf"],
  xls: ["ole", "text", "html", "xml"],
  ppt: ["ole"],
  zip: ["zip", "docx", "xlsx", "pptx", "odf", "jar", "epub", "ooxml"],
  rar: ["rar"],
  "7z": ["7z"],
  gz: ["gz"],
  tgz: ["gz"],
  bz2: ["bz2"],
  xz: ["xz"],
  tar: ["tar"],
  mp3: ["mp3"],
  wav: ["wav"],
  flac: ["flac"],
  ogg: ["ogg"],
  m4a: ["m4a", "mp4"],
  mp4: ["mp4", "mov", "m4a"],
  m4v: ["mp4", "mov"],
  mov: ["mov", "mp4"],
  mkv: ["mkv"],
  webm: ["mkv"],
  avi: ["avi"],
  rtf: ["rtf"],
  exe: ["exe"],
  dll: ["exe"],
  txt: ["text"],
  csv: ["text"],
  tsv: ["text"],
  md: ["text"],
  json: ["text"],
  xml: ["xml", "text"],
  html: ["html", "text", "xml"],
  htm: ["html", "text", "xml"],
};

export function expectedTypesForExt(ext: string): string[] | undefined {
  return EXT_EXPECT[ext];
}

/** Read the first `n` bytes of a blob. */
export async function readHead(blob: Blob, n = 4096): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(0, n).arrayBuffer());
}

/** Full detection (handles ZIP refinement by reading the central directory with JSZip). */
export async function sniffFile(file: Blob): Promise<Signature | null> {
  const head = await readHead(file, 4096);
  const sig = detectSignature(head);
  if (sig?.type === "zip" && file.size < 2_000_000_000) {
    try {
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(file);
      return refineZip(Object.keys(zip.files));
    } catch {
      return sig;
    }
  }
  return sig;
}

/** Map a signature/extension to the conversion "kind" used by tools. */
export function kindOf(name: string, sig?: Signature | null): string {
  if (sig) {
    if (sig.type === "ole") {
      const e = extOf(name);
      if (["doc", "xls", "ppt"].includes(e)) return e;
    }
    if (sig.type === "odf" || sig.type === "zip" || sig.type === "ooxml") {
      const e = extOf(name);
      if (e) return e;
    }
    if (sig.type === "text") {
      const e = extOf(name);
      return e || "txt";
    }
    return sig.type;
  }
  return extOf(name);
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes)) return "—";
  const neg = bytes < 0;
  let b = Math.abs(bytes);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let u = 0;
  while (b >= 1024 && u < units.length - 1) {
    b /= 1024;
    u++;
  }
  const s = u === 0 ? `${Math.round(b)} ${units[u]}` : `${b.toFixed(b >= 100 ? 0 : digits)} ${units[u]}`;
  return neg ? `-${s}` : s;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const sec = Math.round(diff / 1000);
  if (Math.abs(sec) < 45) return "just now";
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 45) return rtf.format(-min, "minute");
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 22) return rtf.format(-hr, "hour");
  const day = Math.round(hr / 24);
  if (Math.abs(day) < 26) return rtf.format(-day, "day");
  const mon = Math.round(day / 30);
  if (Math.abs(mon) < 11) return rtf.format(-mon, "month");
  return rtf.format(-Math.round(day / 365), "year");
}

export function formatDate(ts?: number): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(ts);
}

export const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  heic: "image/heic",
  heif: "image/heif",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp4: "video/mp4",
  webm: "video/webm",
};

export function mimeOf(name: string): string {
  return MIME_BY_EXT[extOf(name)] ?? "application/octet-stream";
}
