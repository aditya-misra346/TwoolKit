/**
 * In-Browser PDF Toolkit using pdf-lib and pdfjs-dist.
 * Provides high-speed, 100% private client-side operations:
 * merge, split, page reordering, rotation, deletion, blank page insertion,
 * page numbering, watermarking, header/footer, signature stamping,
 * cropping, images-to-pdf, and pdf-to-images rendering.
 */

import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";

export interface PageInfo {
  index: number; // 0-based
  pageNumber: number; // 1-based
  width: number;
  height: number;
  rotation: number;
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
  const mergedBytes = await mergedPdf.save();
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
    // Specific ranges or extracted set
    const indices = parsePageRange(rangeStr, total);
    if (indices.length === 0) throw new Error("No valid pages selected in range.");

    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(srcDoc, indices);
    copied.forEach((p) => newDoc.addPage(p));
    const outBytes = await newDoc.save();
    return [{ name: "extracted-pages.pdf", blob: new Blob([outBytes as BlobPart], { type: "application/pdf" }) }];
  }

  // Split into each individual page
  const results: { name: string; blob: Blob }[] = [];
  for (let i = 0; i < total; i++) {
    const singleDoc = await PDFDocument.create();
    const [copied] = await singleDoc.copyPages(srcDoc, [i]);
    singleDoc.addPage(copied);
    const outBytes = await singleDoc.save();
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

  // Find standard dimensions for blank page fallback
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

  const outBytes = await newDoc.save();
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

/** 4. Rotate selected or all pages */
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

  const outBytes = await pdfDoc.save();
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

/** 5. Add Page Numbers */
export interface PageNumberOptions {
  position: "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left";
  format: "number" | "page-of-total" | "page-n"; // "1", "1 of 10", "Page 1"
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

  const outBytes = await pdfDoc.save();
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

/** 6. Watermark PDF */
export interface WatermarkOptions {
  text: string;
  fontSize?: number;
  opacity?: number; // 0..1
  rotation?: number; // degrees
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

    // Center watermark
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

  const outBytes = await pdfDoc.save();
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

/** 7. Add Header and Footer */
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

  const outBytes = await pdfDoc.save();
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

/** 8. Stamp Signature or Image on Page */
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
  const imgBytes = await imageBlob.arrayBuffer();

  const isPng = imageBlob.type === "image/png" || imageBlob.type === "";
  const embeddedImage = isPng
    ? await pdfDoc.embedPng(imgBytes)
    : await pdfDoc.embedJpg(imgBytes);

  const page = pdfDoc.getPage(pageIndex);
  page.drawImage(embeddedImage, {
    x,
    y,
    width,
    height,
  });

  const outBytes = await pdfDoc.save();
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

/** 9. Crop PDF Margins */
export async function cropPdfMargins(
  pdfBlob: Blob,
  cropMarginPts: { top: number; right: number; bottom: number; left: number }
): Promise<Blob> {
  const bytes = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = pdfDoc.getPageCount();

  for (let i = 0; i < total; i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    const newX = cropMarginPts.left;
    const newY = cropMarginPts.bottom;
    const newW = Math.max(72, width - cropMarginPts.left - cropMarginPts.right);
    const newH = Math.max(72, height - cropMarginPts.top - cropMarginPts.bottom);

    page.setCropBox(newX, newY, newW, newH);
  }

  const outBytes = await pdfDoc.save();
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

/** 10. Convert Images into a single PDF */
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
    const imgBytes = await blob.arrayBuffer();

    let embedded;
    if (blob.type === "image/png") {
      embedded = await pdfDoc.embedPng(imgBytes);
    } else {
      // For JPEG or fallback
      embedded = await pdfDoc.embedJpg(imgBytes).catch(async () => {
        // If not standard jpeg, render onto offscreen canvas to convert to PNG
        return await convertBlobToEmbedded(pdfDoc, blob);
      });
    }

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
      // Fit page to image size
      const page = pdfDoc.addPage([imgW, imgH]);
      page.drawImage(embedded, { x: 0, y: 0, width: imgW, height: imgH });
    }
  }

  onProgress?.(0.95, "Compiling PDF document");
  const outBytes = await pdfDoc.save();
  return new Blob([outBytes as BlobPart], { type: "application/pdf" });
}

async function convertBlobToEmbedded(doc: PDFDocument, blob: Blob) {
  return new Promise<any>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = async () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(async (b) => {
        if (!b) return reject(new Error("Failed to encode canvas"));
        const pngBuf = await b.arrayBuffer();
        resolve(await doc.embedPng(pngBuf));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    img.src = url;
  });
}
