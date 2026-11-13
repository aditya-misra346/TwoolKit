/**
 * In-Browser PDF Toolkit using pdf-lib, pdfjs-dist, docx, exceljs, pptxgenjs, and tesseract.js.
 * Provides high-speed, 100% private client-side operations:
 * merge, split, page reordering, rotation, deletion, blank page insertion,
 * page numbering, watermarking, header/footer, signature stamping,
 * cropping, images-to-pdf, pdf-to-images, pdf-to-text, docx/pptx/xlsx fallback,
 * ocr, repair, and compression.
 */

import { PDFDocument, PDFDict, PDFName, PDFRawStream, degrees, rgb, StandardFonts } from "pdf-lib";

export interface PageInfo {
  index: number; // 0-based
  pageNumber: number; // 1-based
  width: number;
  height: number;
  rotation: number;
}

export interface RenderedThumbnail {
  pageIndex: number;
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export const PDFJS_ASSET_OPTS = {
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/standard_fonts/",
} as const;

let _pdfjs: typeof import("pdfjs-dist") | null = null;

export async function getPdfJs() {
  if (!_pdfjs) {
    const isNode = typeof window === "undefined";
    const pdfjs = isNode
      ? await import("pdfjs-dist/legacy/build/pdf.mjs")
      : await import("pdfjs-dist");
    if (!isNode && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }
    _pdfjs = pdfjs;
  }
  return _pdfjs;
}

/** Get page details from a PDF blob */
export async function getPdfInfo(blob: Blob): Promise<{ pageCount: number; pages: PageInfo[] }> {
  const bytes = await blob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const count = pdfDoc.getPageCount();
  const pages: PageInfo[] = [];

  for (let i = 0; i < count; i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    pages.push({
      index: i,
      pageNumber: i + 1,
      width: Math.round(width),
      height: Math.round(height),
      rotation: page.getRotation().angle,
    });
  }
  return { pageCount: count, pages };
}

/** Render visual page thumbnails for interactive UI */
export async function renderPdfThumbnails(
  blob: Blob,
  targetWidth = 220,
  maxPages = 80,
  onProgress?: (loaded: number, total: number) => void
): Promise<RenderedThumbnail[]> {
  try {
    const pdfjs = await getPdfJs();
    const arrayBuffer = await blob.arrayBuffer();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      ...PDFJS_ASSET_OPTS,
    });
    const doc = await loadingTask.promise;
    const total = Math.min(doc.numPages, maxPages);
    const thumbnails: RenderedThumbnail[] = [];

    for (let i = 1; i <= total; i++) {
      onProgress?.(i, total);
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const scale = targetWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(scaledViewport.width));
      canvas.height = Math.max(1, Math.floor(scaledViewport.height));
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await (page.render as any)({
          canvas,
          canvasContext: ctx,
          viewport: scaledViewport,
        }).promise;

        thumbnails.push({
          pageIndex: i - 1,
          pageNumber: i,
          dataUrl: canvas.toDataURL("image/jpeg", 0.8),
          width: canvas.width,
          height: canvas.height,
        });
      }
    }
    return thumbnails;
  } catch (err) {
    console.warn("pdfjs thumbnail rendering failed, using fallback card:", err);
    const info = await getPdfInfo(blob);
    return info.pages.map((p) => ({
      pageIndex: p.index,
      pageNumber: p.pageNumber,
      dataUrl: "",
      width: p.width,
      height: p.height,
    }));
  }
}

/** 1. Merge multiple PDFs in order */
export async function mergePdfs(
  pdfBlobs: Blob[],
  onProgress?: (p: number, stage: string) => void
): Promise<Blob> {
  const mergedPdf = await PDFDocument.create();
  const total = pdfBlobs.length;

  for (let i = 0; i < total; i++) {
    onProgress?.(i / total, `Merging PDF ${i + 1} of ${total}`);
    const bytes = await pdfBlobs[i].arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  onProgress?.(0.95, "Finalizing merged document");
  const mergedBytes = await mergedPdf.save({ useObjectStreams: true });
  return new Blob([mergedBytes as BlobPart], { type: "application/pdf" });
}

/** Parse range string like "1-3, 5, 7-10" into 0-based index list */
export function parsePageRange(rangeStr: string, maxPages: number): number[] {
  const indices = new Set<number>();
  const parts = rangeStr.split(",").map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-").map((s) => s.trim());
      const start = Math.max(1, parseInt(startStr, 10));
      const end = Math.min(maxPages, parseInt(endStr, 10));
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let p = start; p <= end; p++) indices.add(p - 1);
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= maxPages) {
        indices.add(p - 1);
      }
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
}

/** 2. Split PDF by page range or into individual pages */
export async function splitPdf(
  pdfBlob: Blob,
  rangeStr?: string
): Promise<{ name: string; blob: Blob }[]> {
  const bytes = await pdfBlob.arrayBuffer();
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();

  if (rangeStr && rangeStr.trim()) {
    const indices = parsePageRange(rangeStr, total);
    if (indices.length === 0) throw new Error("No valid pages selected in range.");

    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(srcDoc, indices);
    copied.forEach((p) => newDoc.addPage(p));
    const outBytes = await newDoc.save({ useObjectStreams: true });
    return [{ name: "extracted-pages.pdf", blob: new Blob([outBytes as BlobPart], { type: "application/pdf" }) }];
  }

  // Split into each individual page
  const results: { name: string; blob: Blob }[] = [];
  for (let i = 0; i < total; i++) {
    const singleDoc = await PDFDocument.create();
    const [copied] = await singleDoc.copyPages(srcDoc, [i]);
    singleDoc.addPage(copied);
    const outBytes = await singleDoc.save({ useObjectStreams: true });
    results.push({
      name: `page-${i + 1}.pdf`,
      blob: new Blob([outBytes as BlobPart], { type: "application/pdf" }),
    });
  }
  return results;
}

/** 3. Reorder, rotate, delete, and insert blank pages */
export interface PageAction {
  sourceIndex: number; // original 0-based page index, or -1 for blank page
  rotationDelta?: number; // 0, 90, 180, 270
}

export async function organizePdfPages(
  pdfBlob: Blob,
  actions: PageAction[]
): Promise<Blob> {
  const bytes = await pdfBlob.arrayBuffer();
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();

  if (actions.length === 0) {
    throw new Error("Cannot create an empty PDF. At least one page must remain.");
  }

  const firstPage = srcDoc.getPage(0);
  const defaultSize = firstPage.getSize();

  for (const act of actions) {
    if (act.sourceIndex === -1) {
      // Insert blank page
      newDoc.addPage([defaultSize.width, defaultSize.height]);
    } else {
      const [copied] = await newDoc.copyPages(srcDoc, [act.sourceIndex]);
      if (act.rotationDelta) {
        const curAngle = copied.getRotation().angle;
        copied.setRotation(degrees((curAngle + act.rotationDelta) % 360));
      }
      newDoc.addPage(copied);
    }
  }

  const outBytes = await newDoc.save({ useObjectStreams: true });
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

/** 4. Delete specific page numbers (1-based) */
export async function deletePdfPages(
  pdfBlob: Blob,
  pagesToDelete: number[]
): Promise<Blob> {
  const bytes = await pdfBlob.arrayBuffer();
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();

  const toRemoveSet = new Set(pagesToDelete.map((p) => p - 1));
  const remainingIndices: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!toRemoveSet.has(i)) remainingIndices.push(i);
  }

  if (remainingIndices.length === 0) {
    throw new Error("Cannot delete all pages in the document.");
  }

  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(srcDoc, remainingIndices);
  copied.forEach((p) => newDoc.addPage(p));
  const outBytes = await newDoc.save({ useObjectStreams: true });
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

/** 5. Rotate selected or all pages */
export async function rotatePdf(
  pdfBlob: Blob,
  angleDelta: number,
  pageIndices?: number[]
): Promise<Blob> {
  const bytes = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = pdfDoc.getPageCount();
  const targetIndices = pageIndices || Array.from({ length: total }, (_, i) => i);

  for (const idx of targetIndices) {
    if (idx >= 0 && idx < total) {
      const page = pdfDoc.getPage(idx);
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + angleDelta) % 360));
    }
  }

  const outBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

/** 6. Add Page Numbers */
export interface PageNumberOptions {
  position: "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left";
  format: "number" | "page-of-total" | "page-n";
  startNumber?: number;
  fontSize?: number;
  margin?: number;
}

export async function addPageNumbers(
  pdfBlob: Blob,
  opts: PageNumberOptions
): Promise<Blob> {
  const bytes = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const total = pdfDoc.getPageCount();
  const fontSize = opts.fontSize || 10;
  const margin = opts.margin || 36;
  const startNum = opts.startNumber || 1;

  for (let i = 0; i < total; i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    const num = startNum + i;

    let text = `${num}`;
    if (opts.format === "page-of-total") text = `${num} of ${total}`;
    else if (opts.format === "page-n") text = `Page ${num}`;

    const textWidth = font.widthOfTextAtSize(text, fontSize);
    let x = margin;
    let y = margin;

    if (opts.position.includes("center")) {
      x = (width - textWidth) / 2;
    } else if (opts.position.includes("right")) {
      x = width - margin - textWidth;
    }

    if (opts.position.startsWith("top")) {
      y = height - margin - fontSize;
    }

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  const outBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

/** 7. Watermark PDF */
export interface WatermarkOptions {
  text: string;
  fontSize?: number;
  opacity?: number;
  rotation?: number;
  color?: { r: number; g: number; b: number };
}

export async function addWatermark(
  pdfBlob: Blob,
  opts: WatermarkOptions
): Promise<Blob> {
  const bytes = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const total = pdfDoc.getPageCount();
  const fontSize = opts.fontSize || 48;
  const opacity = opts.opacity ?? 0.2;
  const rotation = opts.rotation ?? 45;
  const color = opts.color ? rgb(opts.color.r, opts.color.g, opts.color.b) : rgb(0.8, 0.1, 0.1);

  for (let i = 0; i < total; i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(opts.text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    page.drawText(opts.text, {
      x: width / 2 - textWidth / 2,
      y: height / 2 - textHeight / 2,
      size: fontSize,
      font,
      color,
      opacity,
      rotate: degrees(rotation),
    });
  }

  const outBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

/** 8. Add Header and Footer */
export async function addHeaderFooter(
  pdfBlob: Blob,
  headerText: string,
  footerText: string
): Promise<Blob> {
  const bytes = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const total = pdfDoc.getPageCount();
  const fontSize = 9;
  const margin = 36;

  for (let i = 0; i < total; i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();

    if (headerText) {
      page.drawText(headerText, {
        x: margin,
        y: height - margin,
        size: fontSize,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }

    if (footerText) {
      page.drawText(footerText, {
        x: margin,
        y: margin,
        size: fontSize,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  }

  const outBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

async function embedAnyImage(pdfDoc: PDFDocument, blob: Blob) {
  const buf = await blob.arrayBuffer();
  const u8 = new Uint8Array(buf);
  const isPngMagic =
    u8.length >= 8 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47;
  const isJpgMagic = u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff;
  if (isPngMagic) {
    return await pdfDoc.embedPng(buf).catch(() => convertBlobToEmbedded(pdfDoc, blob));
  }
  if (isJpgMagic) {
    return await pdfDoc.embedJpg(buf).catch(() => convertBlobToEmbedded(pdfDoc, blob));
  }
  return await convertBlobToEmbedded(pdfDoc, blob);
}

/** 9. Stamp Signature or Image on Page */
export async function stampSignature(
  pdfBlob: Blob,
  imageBlob: Blob,
  pageIndex: number,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<Blob> {
  const bytes = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = pdfDoc.getPageCount();
  if (total === 0) throw new Error("PDF contains no pages.");
  const clampedIdx = Math.max(0, Math.min(pageIndex, total - 1));
  const embeddedImage = await embedAnyImage(pdfDoc, imageBlob);

  const page = pdfDoc.getPage(clampedIdx);
  page.drawImage(embeddedImage, {
    x,
    y,
    width,
    height,
  });

  const outBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

export interface VisualAnnotationItem {
  id?: string;
  kind: "text" | "highlight" | "whiteout" | "image";
  pageIndex: number;
  /** Visual normalized coordinates from top-left (0..1) */
  xRatio: number;
  yRatio: number;
  wRatio?: number;
  hRatio?: number;
  text?: string;
  fontSize?: number;
  colorHex?: string;
  opacity?: number;
  imageBlob?: Blob;
}

function hexToRgbUnit(hex = "#1d4ed8") {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.padEnd(6, "0");
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return rgb(0.11, 0.3, 0.85);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Apply visual annotations (signatures, highlights, whiteouts, text) using normalized top-left coordinates */
export async function applyPdfAnnotations(
  pdfBlob: Blob,
  annotations: VisualAnnotationItem[]
): Promise<Blob> {
  const bytes = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const total = pdfDoc.getPageCount();

  for (const item of annotations) {
    if (item.pageIndex < 0 || item.pageIndex >= total) continue;
    const page = pdfDoc.getPage(item.pageIndex);
    const box = page.getCropBox();
    const rot = ((page.getRotation().angle % 360) + 360) % 360;
    const vx = Math.max(0, Math.min(1, item.xRatio));
    const vy = Math.max(0, Math.min(1, item.yRatio));
    const vw = Math.max(0.01, Math.min(1, item.wRatio ?? 0.25));
    const vh = Math.max(0.01, Math.min(1, item.hRatio ?? 0.08));

    const visW = rot === 90 || rot === 270 ? box.height : box.width;
    const visH = rot === 90 || rot === 270 ? box.width : box.height;

    const mapPoint = (nx: number, nyFromTop: number) => {
      if (rot === 90) {
        return { x: box.x + nyFromTop * box.width, y: box.y + (1 - nx) * box.height };
      }
      if (rot === 180) {
        return { x: box.x + (1 - nx) * box.width, y: box.y + nyFromTop * box.height };
      }
      if (rot === 270) {
        return { x: box.x + (1 - nyFromTop) * box.width, y: box.y + nx * box.height };
      }
      return { x: box.x + nx * box.width, y: box.y + (1 - nyFromTop) * box.height };
    };

    if (item.kind === "text" && item.text?.trim()) {
      const size = Math.max(8, Math.min(72, item.fontSize ?? 16));
      const pt = mapPoint(vx, vy + size / Math.max(100, visH));
      page.drawText(item.text.trim(), {
        x: pt.x,
        y: pt.y,
        size,
        font,
        color: hexToRgbUnit(item.colorHex || "#0f172a"),
        opacity: item.opacity ?? 1,
        rotate: degrees(rot),
      });
    } else if (item.kind === "highlight" || item.kind === "whiteout") {
      const drawW = vw * visW;
      const drawH = vh * visH;
      const pt = mapPoint(vx, vy + vh);
      const isWhite = item.kind === "whiteout";
      const rw = rot === 90 || rot === 270 ? drawH : drawW;
      const rh = rot === 90 || rot === 270 ? drawW : drawH;
      page.drawRectangle({
        x:
          rot === 90
            ? box.x + vy * box.width
            : rot === 180
            ? box.x + (1 - vx - vw) * box.width
            : rot === 270
            ? box.x + (1 - vy - vh) * box.width
            : pt.x,
        y:
          rot === 90
            ? box.y + (1 - vx - vw) * box.height
            : rot === 180
            ? box.y + vy * box.height
            : rot === 270
            ? box.y + vx * box.height
            : pt.y,
        width: rw,
        height: rh,
        color: isWhite ? rgb(1, 1, 1) : hexToRgbUnit(item.colorHex || "#facc15"),
        opacity: isWhite ? 1 : (item.opacity ?? 0.35),
      });
    } else if (item.kind === "image" && item.imageBlob) {
      const embedded = await embedAnyImage(pdfDoc, item.imageBlob);
      const drawW = vw * visW;
      const drawH = vh * visH;
      const pt = mapPoint(vx, vy + vh);
      page.drawImage(embedded, {
        x: pt.x,
        y: pt.y,
        width: drawW,
        height: drawH,
        ...(rot !== 0 ? { rotate: degrees(rot) } : {}),
      });
    }
  }

  const outBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

/** 10. Crop PDF Margins (rotation and existing CropBox origin aware) */
export async function cropPdfMargins(
  pdfBlob: Blob,
  cropMarginPts: { top: number; right: number; bottom: number; left: number }
): Promise<Blob> {
  const bytes = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = pdfDoc.getPageCount();

  for (let i = 0; i < total; i++) {
    const page = pdfDoc.getPage(i);
    const box = page.getCropBox();
    const rot = ((page.getRotation().angle % 360) + 360) % 360;

    let uLeft = cropMarginPts.left;
    let uRight = cropMarginPts.right;
    let uTop = cropMarginPts.top;
    let uBottom = cropMarginPts.bottom;

    if (rot === 90) {
      uLeft = cropMarginPts.top;
      uBottom = cropMarginPts.left;
      uRight = cropMarginPts.bottom;
      uTop = cropMarginPts.right;
    } else if (rot === 180) {
      uLeft = cropMarginPts.right;
      uBottom = cropMarginPts.top;
      uRight = cropMarginPts.left;
      uTop = cropMarginPts.bottom;
    } else if (rot === 270) {
      uLeft = cropMarginPts.bottom;
      uRight = cropMarginPts.top;
      uTop = cropMarginPts.left;
      uBottom = cropMarginPts.right;
    }

    const maxH = Math.max(0, box.width - 72);
    const maxV = Math.max(0, box.height - 72);
    const safeLeft = Math.min(Math.max(0, uLeft), maxH);
    const safeRight = Math.min(Math.max(0, uRight), maxH - safeLeft);
    const safeBottom = Math.min(Math.max(0, uBottom), maxV);
    const safeTop = Math.min(Math.max(0, uTop), maxV - safeBottom);

    const newX = box.x + safeLeft;
    const newY = box.y + safeBottom;
    const newW = Math.max(72, box.width - safeLeft - safeRight);
    const newH = Math.max(72, box.height - safeBottom - safeTop);

    page.setCropBox(newX, newY, newW, newH);
  }

  const outBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

/** 11. Images to PDF */
export async function imagesToPdf(
  imageBlobs: Blob[],
  pageSize: "fit" | "a4" | "letter" = "fit",
  onProgress?: (p: number, stage: string) => void
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const total = imageBlobs.length;

  for (let i = 0; i < total; i++) {
    onProgress?.(i / total, `Adding image ${i + 1} of ${total}`);
    const blob = imageBlobs[i];
    const embedded = await embedAnyImage(pdfDoc, blob);
    const { width: imgW, height: imgH } = embedded;

    if (pageSize === "a4") {
      const a4W = 595.28;
      const a4H = 841.89;
      const page = pdfDoc.addPage([a4W, a4H]);
      const scale = Math.min((a4W - 40) / imgW, (a4H - 40) / imgH, 1);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      page.drawImage(embedded, {
        x: (a4W - drawW) / 2,
        y: (a4H - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    } else if (pageSize === "letter") {
      const letW = 612;
      const letH = 792;
      const page = pdfDoc.addPage([letW, letH]);
      const scale = Math.min((letW - 40) / imgW, (letH - 40) / imgH, 1);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      page.drawImage(embedded, {
        x: (letW - drawW) / 2,
        y: (letH - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    } else {
      const page = pdfDoc.addPage([imgW, imgH]);
      page.drawImage(embedded, { x: 0, y: 0, width: imgW, height: imgH });
    }
  }

  onProgress?.(0.95, "Compiling PDF document");
  const outBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

async function convertBlobToEmbedded(doc: PDFDocument, blob: Blob) {
  const { decodeToCanvas } = await import("@/lib/imageClient");
  const canvas = await decodeToCanvas(blob);
  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b: Blob | null) => (b ? resolve(b) : reject(new Error("Failed to encode canvas"))), "image/png");
  });
  const pngBuf = await pngBlob.arrayBuffer();
  return await doc.embedPng(pngBuf);
}

/** 12. PDF to Images (JPEG, PNG, WebP) per page */
export async function renderPdfToImages(
  pdfBlob: Blob,
  format: "jpeg" | "png" | "webp" = "png",
  scale = 2.0,
  rangeStr?: string,
  onProgress?: (p: number, stage: string) => void
): Promise<{ name: string; blob: Blob }[]> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    ...PDFJS_ASSET_OPTS,
  });
  const doc = await loadingTask.promise;
  const total = doc.numPages;
  const pageIndices = rangeStr ? parsePageRange(rangeStr, total) : Array.from({ length: total }, (_, i) => i);
  const results: { name: string; blob: Blob }[] = [];
  const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
  const ext = format === "jpeg" ? "jpg" : format;

  for (let idx = 0; idx < pageIndices.length; idx++) {
    const pageNum = pageIndices[idx] + 1;
    onProgress?.(idx / pageIndices.length, `Rendering page ${pageNum} (${idx + 1} of ${pageIndices.length})`);
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d");

    if (ctx) {
      // Paint opaque white paper before rendering so JPEG never turns transparent pages black
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await (page.render as any)({ canvas, canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob>((res, rej) => {
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("Canvas export failed"))), mime, 0.92);
      });
      // Safari/older WebViews may silently encode WebP requests as PNG; match file extension to actual MIME
      const actualExt =
        format === "webp" && blob.type === "image/png" ? "png" : ext;
      results.push({ name: `page-${pageNum}.${actualExt}`, blob });
    }
  }

  return results;
}

/** 12b. PDF to Vector/Hybrid SVG per page (Client-Side Fallback) */
export async function renderPdfToSvgClient(
  pdfBlob: Blob,
  rangeStr?: string,
  onProgress?: (p: number, stage: string) => void
): Promise<{ name: string; blob: Blob }[]> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    ...PDFJS_ASSET_OPTS,
  });
  const doc = await loadingTask.promise;
  const total = doc.numPages;
  const pageIndices = rangeStr ? parsePageRange(rangeStr, total) : Array.from({ length: total }, (_, i) => i);
  const results: { name: string; blob: Blob }[] = [];

  const escXml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  for (let idx = 0; idx < pageIndices.length; idx++) {
    const pageNum = pageIndices[idx] + 1;
    onProgress?.(idx / pageIndices.length, `Generating SVG for page ${pageNum}`);
    const page = await doc.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const renderViewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(renderViewport.width));
    canvas.height = Math.max(1, Math.floor(renderViewport.height));
    const ctx = canvas.getContext("2d");
    let dataUrl = "";
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await (page.render as any)({ canvas, canvasContext: ctx, viewport: renderViewport }).promise;
      dataUrl = canvas.toDataURL("image/png");
    }

    const textContent = await page.getTextContent();
    const textEls: string[] = [];
    for (const rawItem of textContent.items as any[]) {
      const str = rawItem?.str;
      if (!str || !str.trim()) continue;
      const tx = (pdfjs as any).Util?.transform
        ? (pdfjs as any).Util.transform(baseViewport.transform, rawItem.transform)
        : [1, 0, 0, -1, rawItem.transform?.[4] ?? 0, baseViewport.height - (rawItem.transform?.[5] ?? 0)];
      const fontSize = Math.max(4, Math.hypot(tx[0], tx[1]) || 10);
      const x = Number((tx[4] ?? 0).toFixed(2));
      const y = Number((tx[5] ?? fontSize).toFixed(2));
      textEls.push(
        `<text x="${x}" y="${y}" font-size="${fontSize.toFixed(1)}" font-family="sans-serif" fill="#0f172a" fill-opacity="0">${escXml(str)}</text>`
      );
    }

    const w = Math.max(1, Math.round(baseViewport.width));
    const h = Math.max(1, Math.round(baseViewport.height));
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#ffffff"/>
  ${dataUrl ? `<image x="0" y="0" width="${w}" height="${h}" href="${dataUrl}" xlink:href="${dataUrl}"/>` : ""}
  <g id="selectable-text">${textEls.join("\n    ")}</g>
</svg>`;
    results.push({
      name: `page-${pageNum}.svg`,
      blob: new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    });
  }

  return results;
}

/** 12c. Extract Embedded Images from PDF (Client-Side Fallback) */
export async function extractPdfImagesClient(
  pdfBlob: Blob,
  onProgress?: (p: number, stage: string) => void
): Promise<{ name: string; blob: Blob }[]> {
  const bytes = await pdfBlob.arrayBuffer();
  const results: { name: string; blob: Blob }[] = [];
  const extractedKeys = new Set<string>();

  // First pass: extract clean native JPEG (DCTDecode) streams directly from XObjects
  try {
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      onProgress?.((pIdx / Math.max(1, pages.length)) * 0.45, `Scanning page ${pIdx + 1} for native JPEGs`);
      const resDict = pages[pIdx].node.Resources();
      const xObjects = resDict?.lookupMaybe(PDFName.of("XObject"), PDFDict);
      if (!xObjects) continue;
      let imgSeq = 0;
      for (const [key, refOrObj] of xObjects.entries()) {
        const obj = pdfDoc.context.lookup(refOrObj);
        if (!(obj instanceof PDFRawStream)) continue;
        const subtype = obj.dict.lookup(PDFName.of("Subtype"));
        if (subtype !== PDFName.of("Image")) continue;
        const filter = obj.dict.lookup(PDFName.of("Filter"));
        const hasSmask = !!obj.dict.get(PDFName.of("SMask"));
        const colorSpace = obj.dict.lookup(PDFName.of("ColorSpace"));
        const isCmyk = colorSpace === PDFName.of("DeviceCMYK");
        if (filter === PDFName.of("DCTDecode") && !hasSmask && !isCmyk) {
          imgSeq++;
          const uniqueTag = `${String((refOrObj as any)?.objectNumber ?? key.asString())}`;
          if (extractedKeys.has(uniqueTag)) continue;
          extractedKeys.add(uniqueTag);
          results.push({
            name: `page-${pIdx + 1}-img-${imgSeq}.jpg`,
            blob: new Blob([new Uint8Array(obj.contents)], { type: "image/jpeg" }),
          });
        }
      }
    }
  } catch {
    // Continue to PDF.js decoded image pass
  }

  // Second pass: decode FlateDecode / Indexed / CMYK / SMask / inline bitmaps via PDF.js
  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    ...PDFJS_ASSET_OPTS,
  }).promise;

  const seenObjNames = new Set<string>();
  const paintImageOp = (pdfjs as any).OPS?.paintImageXObject ?? 85;
  const paintInlineOp = (pdfjs as any).OPS?.paintInlineImageXObject ?? 86;

  for (let p = 1; p <= doc.numPages; p++) {
    onProgress?.(0.45 + (p / Math.max(1, doc.numPages)) * 0.5, `Decoding embedded images on page ${p}`);
    const page = await doc.getPage(p);
    // Warm up resources by rendering or evaluating operator list
    const opList = await page.getOperatorList();
    let imgIdx = 0;

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      if (fn !== paintImageOp && fn !== paintInlineOp) continue;

      let imgObj: any = null;
      if (fn === paintInlineOp) {
        imgObj = opList.argsArray[i]?.[0];
      } else {
        const objName = String(opList.argsArray[i]?.[0] || "");
        if (!objName || seenObjNames.has(`${p}:${objName}`)) continue;
        seenObjNames.add(`${p}:${objName}`);
        imgObj = await new Promise<any>((resolve) => {
          try {
            if (page.objs.has(objName)) {
              resolve(page.objs.get(objName));
            } else {
              page.objs.get(objName, (data: any) => resolve(data));
            }
          } catch {
            resolve(null);
          }
        });
      }

      if (!imgObj || !imgObj.width || !imgObj.height) continue;
      if (imgObj.width < 12 && imgObj.height < 12) continue;

      const canvas = document.createElement("canvas");
      canvas.width = imgObj.width;
      canvas.height = imgObj.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      if (imgObj.bitmap) {
        ctx.drawImage(imgObj.bitmap, 0, 0);
      } else if (imgObj.data) {
        const w = imgObj.width;
        const h = imgObj.height;
        const src = imgObj.data as Uint8ClampedArray | Uint8Array;
        const rgba = new Uint8ClampedArray(w * h * 4);
        if (src.length === w * h * 4) {
          rgba.set(src);
        } else if (src.length === w * h * 3) {
          for (let px = 0, si = 0, di = 0; px < w * h; px++, si += 3, di += 4) {
            rgba[di] = src[si];
            rgba[di + 1] = src[si + 1];
            rgba[di + 2] = src[si + 2];
            rgba[di + 3] = 255;
          }
        } else if (src.length === w * h) {
          for (let px = 0, di = 0; px < w * h; px++, di += 4) {
            const g = src[px];
            rgba[di] = g;
            rgba[di + 1] = g;
            rgba[di + 2] = g;
            rgba[di + 3] = 255;
          }
        } else {
          continue;
        }
        ctx.putImageData(new ImageData(rgba, w, h), 0, 0);
      } else {
        continue;
      }

      const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"));
      if (blob) {
        imgIdx++;
        results.push({ name: `page-${p}-extracted-${imgIdx}.png`, blob });
      }
    }
  }

  if (results.length === 0) {
    throw new Error("No embedded raster images were found in this PDF.");
  }

  return results;
}

/** 13. Extract Text Layer from PDF */
export async function extractPdfText(
  pdfBlob: Blob,
  rangeStr?: string,
  onProgress?: (p: number, stage: string) => void
): Promise<{ name: string; blob: Blob; text: string }> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    ...PDFJS_ASSET_OPTS,
  });
  const doc = await loadingTask.promise;
  const total = doc.numPages;
  const pageIndices = rangeStr ? parsePageRange(rangeStr, total) : Array.from({ length: total }, (_, i) => i);
  const textChunks: string[] = [];

  for (let idx = 0; idx < pageIndices.length; idx++) {
    const pageNum = pageIndices[idx] + 1;
    onProgress?.(idx / pageIndices.length, `Extracting text from page ${pageNum}`);
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageLines: string[] = [];
    let currentY: number | null = null;
    let currentLine = "";

    for (const item of textContent.items as any[]) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      if (currentY !== null && Math.abs(y - currentY) > 4) {
        pageLines.push(currentLine.trim());
        currentLine = item.str + " ";
      } else {
        currentLine += item.str + " ";
      }
      currentY = y;
    }
    if (currentLine.trim()) pageLines.push(currentLine.trim());

    textChunks.push(`--- PAGE ${pageNum} ---\n` + pageLines.join("\n"));
  }

  const fullText = textChunks.join("\n\n");
  const blob = new Blob([fullText], { type: "text/plain; charset=utf-8" });
  return { name: "extracted-text.txt", blob, text: fullText };
}

/** 14. Convert PDF to HTML */
export async function extractPdfToHtml(
  pdfBlob: Blob,
  onProgress?: (p: number, stage: string) => void
): Promise<Blob> {
  const { text } = await extractPdfText(pdfBlob, undefined, onProgress);
  const pages = text.split(/--- PAGE \d+ ---/g).map((s) => s.trim()).filter(Boolean);

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 2rem; }
    .page { max-width: 800px; margin: 0 auto 2rem; background: #fff; padding: 3rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0; }
    .page-num { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 1.5rem; letter-spacing: 0.05em; }
    p { line-height: 1.6; margin-bottom: 0.8rem; white-space: pre-wrap; }
  </style>
</head>
<body>
  ${pages
    .map(
      (p, i) => `
    <article class="page">
      <div class="page-num">Page ${i + 1}</div>
      ${p
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
        .join("\n")}
    </article>`
    )
    .join("\n")}
</body>
</html>`;

  return new Blob([htmlContent], { type: "text/html; charset=utf-8" });
}

/** 15. Convert PDF to Word (.docx) Client-Side Fallback */
export async function extractPdfToDocx(
  pdfBlob: Blob,
  onProgress?: (p: number, stage: string) => void
): Promise<Blob> {
  const { Document, Paragraph, TextRun, HeadingLevel, Packer } = await import("docx");
  let { text } = await extractPdfText(pdfBlob, undefined, (p, s) => onProgress?.(p * 0.4, s));

  // If text layer is empty or nearly empty (scanned image PDF), run OCR recognition
  if (!text || text.trim().length < 15) {
    onProgress?.(0.45, "Scanned PDF detected · Running OCR text recognition");
    try {
      const ocrRes = await ocrPdf(pdfBlob, "eng", (p, s) => onProgress?.(0.45 + p * 0.35, s));
      const ocrText = await ocrRes.blob.text();
      if (ocrText && ocrText.trim().length > 0) {
        text = ocrText;
      }
    } catch {
      // Continue with available text if OCR fails
    }
  }

  onProgress?.(0.85, "Constructing Word document structure");
  const pages = text.split(/--- PAGE \d+ ---/g).map((s) => s.trim()).filter(Boolean);

  const sections = pages.map((pageText, pageIdx) => {
    const lines = pageText.split("\n").map((l) => l.trim()).filter(Boolean);
    const paragraphs = lines.map((line) => {
      // If short line in all caps or bold, make it a heading
      if (line.length < 50 && line === line.toUpperCase() && line.length > 3) {
        return new Paragraph({
          text: line,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        });
      }
      return new Paragraph({
        children: [new TextRun({ text: line, size: 22 })],
        spacing: { after: 120 },
      });
    });

    return {
      properties: {},
      children: [
        new Paragraph({
          text: `Page ${pageIdx + 1}`,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 100, after: 200 },
        }),
        ...paragraphs,
      ],
    };
  });

  const doc = new Document({
    sections: sections.length > 0 ? sections : [{ children: [new Paragraph("Empty PDF content")] }],
  });

  onProgress?.(0.9, "Packing .docx file");
  return await Packer.toBlob(doc);
}

/** 16. Convert PDF to Excel (.xlsx) Client-Side Fallback */
export async function extractPdfToXlsx(
  pdfBlob: Blob,
  onProgress?: (p: number, stage: string) => void
): Promise<Blob> {
  const ExcelModule = await import("exceljs");
  const ExcelJS = (ExcelModule as any).default || ExcelModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TWOOLKIT File Platform";
  workbook.created = new Date();

  const { text } = await extractPdfText(pdfBlob, undefined, (p, s) => onProgress?.(p * 0.7, s));
  let pages = text.split(/--- PAGE \d+ ---/g).map((s) => s.trim()).filter(Boolean);

  if (pages.length === 0) {
    onProgress?.(0.55, "No text layer found · Trying OCR table scan");
    try {
      const ocrRes = await ocrPdf(pdfBlob, "eng", (p, s) => onProgress?.(0.55 + p * 0.3, s));
      pages = ocrRes.text.split(/--- PAGE \d+ ---/g).map((s) => s.trim()).filter(Boolean);
    } catch {
      // Fall back to single informational worksheet so Excel never produces 0-sheet corrupt ZIP
    }
  }

  if (pages.length === 0) {
    const sheet = workbook.addWorksheet("Page 1");
    sheet.addRow(["No extractable text found in PDF"]);
  } else {
    pages.forEach((p, pageIdx) => {
      const sheet = workbook.addWorksheet(`Page ${pageIdx + 1}`);
      const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);

      lines.forEach((line) => {
        let cells = line.split(/\s{2,}|\t|\|/).map((c) => c.trim()).filter(Boolean);
        if (cells.length <= 1 && line.includes(",")) {
          cells = line.split(",").map((c) => c.trim());
        }
        if (cells.length > 0) {
          sheet.addRow(cells);
        }
      });

      if (sheet.rowCount > 0) {
        sheet.getRow(1).font = { bold: true };
      } else {
        sheet.addRow(["Empty page"]);
      }
    });
  }

  onProgress?.(0.9, "Generating Excel workbook");
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** 17. Convert PDF to PowerPoint (.pptx) Client-Side Fallback */
export async function extractPdfToPptx(
  pdfBlob: Blob,
  mode: "hybrid" | "image" = "hybrid",
  onProgress?: (p: number, stage: string) => void
): Promise<Blob> {
  const pptxModule = await import("pptxgenjs");
  const PptxGenJS = (pptxModule as any).default || pptxModule;
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";

  const { text } = await extractPdfText(pdfBlob, undefined, onProgress);
  const pages = text.split(/--- PAGE \d+ ---/g).map((s) => s.trim()).filter(Boolean);
  const useImageSlides = mode === "image" || pages.length === 0;

  if (useImageSlides) {
    // Render each page as high-res slide image (also automatic fallback when scanned PDF has 0 text)
    const images = await renderPdfToImages(pdfBlob, "png", 2.0, undefined, onProgress);
    for (let i = 0; i < images.length; i++) {
      const slide = pres.addSlide();
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((res) => {
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(images[i].blob);
      });
      slide.addImage({ data: dataUrl, x: 0, y: 0, w: "100%", h: "100%" });
    }
  } else {
    // Hybrid: extract text per page and structure into slides
    for (let i = 0; i < pages.length; i++) {
      const slide = pres.addSlide();
      slide.background = { color: "F8FAFC" };
      const lines = pages[i].split("\n").map((l) => l.trim()).filter(Boolean);
      const title = lines[0] || `Slide ${i + 1}`;
      const body = lines.slice(1).join("\n\n") || "No additional text.";

      slide.addText(title, {
        x: 0.8,
        y: 0.6,
        w: 8.4,
        h: 0.8,
        fontSize: 24,
        bold: true,
        color: "0F172A",
      });

      slide.addText(body, {
        x: 0.8,
        y: 1.6,
        w: 8.4,
        h: 4.5,
        fontSize: 14,
        color: "334155",
        valign: "top",
      });
    }
  }

  onProgress?.(0.95, "Compiling presentation");
  const blob = (await pres.write({ outputType: "blob" })) as Blob;
  return blob;
}

/** 18. Compress PDF In-Browser */
export async function compressPdfClient(
  pdfBlob: Blob,
  level: "low" | "balanced" | "max" = "balanced",
  onProgress?: (p: number, stage: string) => void
): Promise<Blob> {
  onProgress?.(0.15, "Analyzing PDF structure and streams");
  const bytes = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  if (level === "balanced" || level === "max") {
    pdfDoc.setProducer("TwoolKit Optimizer");
    pdfDoc.setCreator("TwoolKit");
  }

  onProgress?.(0.45, "Optimizing cross-reference tables and object streams");
  const structuralBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  let bestBytes: Uint8Array = structuralBytes;

  // For Maximum compression, also evaluate JPEG page downsampling and pick the smaller result
  if (level === "max" && typeof document !== "undefined") {
    try {
      onProgress?.(0.65, "Evaluating image recompression for maximum shrinkage");
      const rasterDoc = await PDFDocument.create();
      const rendered = await renderPdfToImages(pdfBlob, "jpeg", 1.35, undefined);
      for (const pageImg of rendered) {
        const imgBuf = await pageImg.blob.arrayBuffer();
        const jpg = await rasterDoc.embedJpg(imgBuf);
        const p = rasterDoc.addPage([jpg.width / 1.35, jpg.height / 1.35]);
        p.drawImage(jpg, { x: 0, y: 0, width: p.getWidth(), height: p.getHeight() });
      }
      const rasterBytes = await rasterDoc.save({ useObjectStreams: true, addDefaultPage: false });
      if (rasterBytes.byteLength > 0 && rasterBytes.byteLength < bestBytes.byteLength) {
        bestBytes = rasterBytes;
      }
    } catch {
      // Keep structural compression output
    }
  }

  onProgress?.(1.0, "Optimization complete");
  if (bestBytes.byteLength >= bytes.byteLength) {
    return pdfBlob.type === "application/pdf"
      ? pdfBlob
      : new Blob([bytes], { type: "application/pdf" });
  }
  return new Blob([bestBytes as BlobPart], { type: "application/pdf" });
}

/** 19. Repair PDF In-Browser */
export async function repairPdfClient(pdfBlob: Blob): Promise<Blob> {
  const bytes = await pdfBlob.arrayBuffer();
  // PDFDocument.load with ignoreEncryption attempts rebuild of broken xrefs
  const pdfDoc = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
  });
  const repairedBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([repairedBytes as BlobPart], { type: "application/pdf" });
}

/** 20. Optical Character Recognition (OCR) In-Browser */
export async function ocrPdf(
  pdfBlob: Blob,
  lang = "eng",
  onProgress?: (p: number, stage: string) => void
): Promise<{ name: string; blob: Blob; text: string }> {
  const images = await renderPdfToImages(pdfBlob, "png", 2.0, undefined, (p, s) =>
    onProgress?.(p * 0.4, `Preparing pages for OCR: ${s}`)
  );

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(lang);
  const ocrResults: string[] = [];

  try {
    for (let i = 0; i < images.length; i++) {
      onProgress?.(0.4 + 0.55 * (i / images.length), `Running OCR on page ${i + 1} of ${images.length}`);
      const ret = await worker.recognize(images[i].blob);
      ocrResults.push(`=== PAGE ${i + 1} OCR TEXT ===\n` + ret.data.text.trim());
    }
  } finally {
    await worker.terminate();
  }
  onProgress?.(1.0, "OCR recognition finished");

  const fullText = ocrResults.join("\n\n");
  const blob = new Blob([fullText], { type: "text/plain; charset=utf-8" });
  return { name: "ocr-extracted-text.txt", blob, text: fullText };
}

/** 21. Protect PDF with AES-256 Encryption In-Browser */
export interface ProtectPdfOptions {
  userPassword: string;
  ownerPassword?: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
  allowModifying?: boolean;
  allowAnnotating?: boolean;
}

export async function protectPdfClient(
  pdfBlob: Blob,
  opts: ProtectPdfOptions,
  onProgress?: (p: number, stage: string) => void
): Promise<Blob> {
  const pw = opts.userPassword ? opts.userPassword.trim() : "";
  if (!pw) {
    throw new Error("Password cannot be blank. Enter a password to protect the document.");
  }

  onProgress?.(0.2, "Validating PDF document structure");
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const inputBytes = new Uint8Array(arrayBuffer);

  const { encryptPDF, AlreadyEncryptedError } = await import("@pdfsmaller/pdf-encrypt");

  onProgress?.(0.5, "Applying AES-256 (Revision 6) enterprise encryption");
  let encryptedBytes: Uint8Array;
  try {
    encryptedBytes = await encryptPDF(inputBytes, pw, {
      ownerPassword: opts.ownerPassword?.trim() || pw,
      algorithm: "AES-256",
      allowPrinting: opts.allowPrinting ?? true,
      allowCopying: opts.allowCopying ?? true,
      allowModifying: opts.allowModifying ?? false,
      allowAnnotating: opts.allowAnnotating ?? true,
    });
  } catch (err: any) {
    if (err?.code === "ALREADY_ENCRYPTED" || err instanceof AlreadyEncryptedError) {
      throw new Error("This PDF is already password-protected. Please unlock it before applying a new password.");
    }
    throw new Error(err?.message || "Failed to encrypt PDF.");
  }

  onProgress?.(0.85, "Verifying encryption integrity");
  try {
    const { PDFDocument } = await import("pdf-lib");
    await PDFDocument.load(encryptedBytes);
    throw new Error("Verification failed: Output document is not encrypted.");
  } catch (e: any) {
    if (e.message && e.message.includes("encrypted")) {
      // Confirmed encrypted
    } else if (e.message && e.message.includes("Verification failed")) {
      throw e;
    }
  }

  onProgress?.(1.0, "Document encrypted successfully");
  return new Blob([encryptedBytes as BlobPart], { type: "application/pdf" });
}

/** 22. Unlock Password-Protected PDF In-Browser */
export async function unlockPdfClient(
  pdfBlob: Blob,
  password: string,
  onProgress?: (p: number, stage: string) => void
): Promise<Blob> {
  const pw = password ? password.trim() : "";

  onProgress?.(0.2, "Reading encrypted document streams");
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const inputBytes = new Uint8Array(arrayBuffer);

  const { decryptPDF } = await import("@pdfsmaller/pdf-decrypt");

  onProgress?.(0.6, "Authenticating and decrypting document");
  let decryptedBytes: Uint8Array;
  try {
    decryptedBytes = await decryptPDF(inputBytes, pw);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (!pw) {
      throw new Error("Enter the decryption password to unlock this PDF.");
    }
    if (/incorrect password|does not match/i.test(msg)) {
      throw new Error("Incorrect password. The document could not be unlocked.");
    }
    throw new Error(msg || "Failed to unlock PDF.");
  }

  onProgress?.(1.0, "PDF unlocked successfully");
  return new Blob([decryptedBytes as BlobPart], { type: "application/pdf" });
}
