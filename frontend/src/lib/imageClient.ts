/**
 * Client-Side Image Converter, Editor, Optimizer, and Metadata Inspector.
 * Uses HTML5 Canvas, UTIF for TIFF decoding/encoding, exifr for metadata inspection,
 * heic-decode for in-browser HEIC decoding, gifenc for genuine GIF encoding,
 * upng-js for PNG quantization/compression, and bmp-js for authentic BMP encoding.
 */

import exifr from "exifr";
import UTIF from "utif2";
import decodeHeic from "heic-decode";
import bmp from "bmp-js";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import UPNG from "upng-js";

export interface ImageMeta {
  width: number;
  height: number;
  format?: string;
  make?: string;
  model?: string;
  dateTime?: string;
  exposureTime?: number;
  fNumber?: number;
  iso?: number;
  lensModel?: string;
  latitude?: number;
  longitude?: number;
  rawExif?: Record<string, unknown>;
}

export interface ImageEditOptions {
  width?: number;
  height?: number;
  crop?: { x: number; y: number; width: number; height: number };
  rotate?: number; // 0, 90, 180, 270
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  grayscale?: boolean;
  brightness?: number; // -100 to 100, default 0
  contrast?: number; // -100 to 100, default 0
}

export type SupportedTargetFormat =
  | "jpeg"
  | "jpg"
  | "png"
  | "webp"
  | "avif"
  | "gif"
  | "bmp"
  | "ico"
  | "tiff"
  | "tif";

export interface ImageConvertOptions extends ImageEditOptions {
  targetFormat: SupportedTargetFormat;
  quality?: number; // 1..100
  backgroundColor?: string; // Hex for flattening alpha, e.g. "#ffffff"
  stripMetadata?: boolean;
}

export interface ImageConvertResult {
  blob: Blob;
  warnings: string[];
  width: number;
  height: number;
  format: string;
}

/** Accurately calculate file size reduction percentage */
export function calculateReduction(
  originalBytes: number,
  newBytes: number
): { savedBytes: number; percent: number; isSmaller: boolean } {
  const diff = originalBytes - newBytes;
  const percent = originalBytes > 0 ? (diff / originalBytes) * 100 : 0;
  return {
    savedBytes: Math.max(0, diff),
    percent: Math.round(percent * 10) / 10,
    isSmaller: diff > 0,
  };
}

/** Decode any image Blob (including TIFF, HEIC, and SVG) into an HTMLCanvasElement */
export async function decodeToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const fileName = (blob as File).name?.toLowerCase() || "";
  const isTiff =
    blob.type.includes("tiff") ||
    fileName.endsWith(".tif") ||
    fileName.endsWith(".tiff");

  // 1. TIFF decoding via utif2
  if (isTiff) {
    const buf = await blob.arrayBuffer();
    const ifds = UTIF.decode(buf);
    if (!ifds || ifds.length === 0) throw new Error("Could not decode TIFF directory.");
    UTIF.decodeImage(buf, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const canvas = document.createElement("canvas");
    canvas.width = ifds[0].width;
    canvas.height = ifds[0].height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    const imgData = ctx.createImageData(ifds[0].width, ifds[0].height);
    imgData.data.set(rgba);
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  // 2. HEIC / HEIF decoding via heic-decode
  const isHeic =
    blob.type.includes("heic") ||
    blob.type.includes("heif") ||
    fileName.endsWith(".heic") ||
    fileName.endsWith(".heif");

  if (isHeic) {
    try {
      const buf = await blob.arrayBuffer();
      const { width, height, data } = await decodeHeic({ buffer: buf });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");
      const imgData = ctx.createImageData(width, height);
      imgData.data.set(new Uint8ClampedArray(data));
      ctx.putImageData(imgData, 0, 0);
      return canvas;
    } catch (err: any) {
      throw new Error(`Failed to decode HEIC image: ${err?.message || "unsupported HEIC codec"}`);
    }
  }

  // 3. SVG decoding with XSS sanitization and viewBox aspect resolution
  const isSvg =
    blob.type.includes("svg") ||
    fileName.endsWith(".svg");

  if (isSvg) {
    let svgText = await blob.text();
    // Strip script tags and inline event handlers for safe rendering
    svgText = svgText
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
      .replace(/javascript:/gi, "");

    // Extract viewBox dimensions if fixed width/height are absent
    let targetW = 800;
    let targetH = 600;
    const vbMatch = svgText.match(/viewBox\s*=\s*["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i);
    if (vbMatch) {
      const vbW = parseFloat(vbMatch[3]);
      const vbH = parseFloat(vbMatch[4]);
      if (!isNaN(vbW) && !isNaN(vbH) && vbW > 0 && vbH > 0) {
        targetW = Math.round(vbW);
        targetH = Math.round(vbH);
      }
    }

    const sanitizedBlob = new Blob([svgText], { type: "image/svg+xml" });
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(sanitizedBlob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || targetW;
        canvas.height = img.naturalHeight || targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas context unavailable"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not decode SVG image."));
      };
      img.src = url;
    });
  }

  // 4. Standard formats (PNG, JPEG, WebP, GIF, BMP)
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.crossOrigin = "anonymous";
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image file in browser."));
    };
    img.src = url;
  });
}

/** Extract EXIF, camera, and GPS metadata */
export async function inspectMetadata(blob: Blob): Promise<ImageMeta | null> {
  try {
    const exifData = await exifr.parse(blob, {
      tiff: true,
      xmp: true,
      icc: false,
      jfif: true,
      gps: true,
    });
    if (!exifData) return null;

    return {
      width: exifData.ImageWidth || exifData.ExifImageWidth,
      height: exifData.ImageHeight || exifData.ExifImageHeight,
      format: exifData.format,
      make: exifData.Make,
      model: exifData.Model,
      dateTime: exifData.DateTimeOriginal?.toString() || exifData.CreateDate?.toString() || exifData.ModifyDate?.toString(),
      exposureTime: exifData.ExposureTime,
      fNumber: exifData.FNumber,
      iso: exifData.ISO,
      lensModel: exifData.LensModel,
      latitude: exifData.latitude,
      longitude: exifData.longitude,
      rawExif: exifData,
    };
  } catch {
    return null;
  }
}

/** Apply edit transformations (crop, resize, rotate, flip, color filters) */
export function applyImageEdits(
  sourceCanvas: HTMLCanvasElement,
  opts: ImageEditOptions
): HTMLCanvasElement {
  let curCanvas = sourceCanvas;

  // 1. Crop
  if (opts.crop && opts.crop.width > 0 && opts.crop.height > 0) {
    const cropped = document.createElement("canvas");
    cropped.width = Math.min(opts.crop.width, curCanvas.width);
    cropped.height = Math.min(opts.crop.height, curCanvas.height);
    const ctx = cropped.getContext("2d");
    if (ctx) {
      ctx.drawImage(
        curCanvas,
        Math.max(0, opts.crop.x),
        Math.max(0, opts.crop.y),
        cropped.width,
        cropped.height,
        0,
        0,
        cropped.width,
        cropped.height
      );
      curCanvas = cropped;
    }
  }

  // 2. Resize
  const targetW = opts.width || curCanvas.width;
  const targetH = opts.height || curCanvas.height;
  if (targetW !== curCanvas.width || targetH !== curCanvas.height) {
    const resized = document.createElement("canvas");
    resized.width = targetW;
    resized.height = targetH;
    const ctx = resized.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(curCanvas, 0, 0, targetW, targetH);
      curCanvas = resized;
    }
  }

  // 3. Rotate & Flip
  const rotation = (((opts.rotate || 0) % 360) + 360) % 360;
  const flipH = opts.flipHorizontal ? -1 : 1;
  const flipV = opts.flipVertical ? -1 : 1;

  if (rotation !== 0 || flipH !== 1 || flipV !== 1) {
    const transformed = document.createElement("canvas");
    const isSideways = rotation === 90 || rotation === 270;
    transformed.width = isSideways ? curCanvas.height : curCanvas.width;
    transformed.height = isSideways ? curCanvas.width : curCanvas.height;
    const ctx = transformed.getContext("2d");
    if (ctx) {
      ctx.translate(transformed.width / 2, transformed.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH, flipV);
      ctx.drawImage(curCanvas, -curCanvas.width / 2, -curCanvas.height / 2);
      curCanvas = transformed;
    }
  }

  // 4. Color adjustments (grayscale, brightness, contrast)
  if (opts.grayscale || opts.brightness || opts.contrast) {
    const ctx = curCanvas.getContext("2d");
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, curCanvas.width, curCanvas.height);
      const data = imgData.data;
      const bAdj = (opts.brightness || 0) * 1.5;
      const cFactor = ((opts.contrast || 0) + 100) / 100;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Grayscale: ITU-R BT.601 standard
        if (opts.grayscale) {
          const v = 0.299 * r + 0.587 * g + 0.114 * b;
          r = v;
          g = v;
          b = v;
        }

        // Contrast
        if (opts.contrast) {
          r = (r - 128) * cFactor + 128;
          g = (g - 128) * cFactor + 128;
          b = (b - 128) * cFactor + 128;
        }

        // Brightness
        if (opts.brightness) {
          r += bAdj;
          g += bAdj;
          b += bAdj;
        }

        data[i] = Math.min(255, Math.max(0, r));
        data[i + 1] = Math.min(255, Math.max(0, g));
        data[i + 2] = Math.min(255, Math.max(0, b));
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }

  return curCanvas;
}

/** Flatten canvas alpha channel over a background color */
function flattenCanvasBackground(
  sourceCanvas: HTMLCanvasElement,
  backgroundColor: string
): HTMLCanvasElement {
  const bgCanvas = document.createElement("canvas");
  bgCanvas.width = sourceCanvas.width;
  bgCanvas.height = sourceCanvas.height;
  const bgCtx = bgCanvas.getContext("2d");
  if (bgCtx) {
    bgCtx.fillStyle = backgroundColor || "#ffffff";
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.drawImage(sourceCanvas, 0, 0);
    return bgCanvas;
  }
  return sourceCanvas;
}

/** Process and convert an image, returning the generated Blob and any warnings */
export async function convertAndOptimizeImage(
  blob: Blob,
  opts: ImageConvertOptions
): Promise<ImageConvertResult> {
  const warnings: string[] = [];
  const rawCanvas = await decodeToCanvas(blob);
  const finalCanvas = applyImageEdits(rawCanvas, opts);

  const targetFormat = opts.targetFormat.toLowerCase() as SupportedTargetFormat;
  const rawQuality = opts.quality ?? 85;
  const quality = Math.max(0.01, Math.min(1.0, rawQuality / 100));

  const width = finalCanvas.width;
  const height = finalCanvas.height;

  // 1. JPEG / JPG
  if (targetFormat === "jpeg" || targetFormat === "jpg") {
    const flatCanvas = flattenCanvasBackground(finalCanvas, opts.backgroundColor || "#ffffff");
    warnings.push(`JPEG does not support transparency; transparent areas filled with ${opts.backgroundColor || "white"}.`);
    return new Promise((resolve, reject) => {
      flatCanvas.toBlob(
        (outBlob) => {
          if (!outBlob) return reject(new Error("Failed to encode JPEG image."));
          resolve({ blob: outBlob, warnings, width, height, format: "jpeg" });
        },
        "image/jpeg",
        quality
      );
    });
  }

  // 2. PNG (with genuine UPNG quantization for compression)
  if (targetFormat === "png") {
    const ctx = finalCanvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    const imgData = ctx.getImageData(0, 0, width, height);

    // If quality is high (>=95), use lossless PNG
    if (rawQuality >= 95) {
      const pngBytes = UPNG.encode([imgData.data.buffer], width, height, 0);
      const outBlob = new Blob([pngBytes as BlobPart], { type: "image/png" });
      return { blob: outBlob, warnings, width, height, format: "png" };
    }

    // Lossy PNG quantization (cnum colors: 16 to 256 depending on quality)
    const cnum = Math.max(16, Math.min(256, Math.round((rawQuality / 100) * 256)));
    const pngBytes = UPNG.encode([imgData.data.buffer], width, height, cnum);
    const outBlob = new Blob([pngBytes as BlobPart], { type: "image/png" });
    warnings.push(`Quantized to ${cnum} indexed colors for optimized PNG size.`);
    return { blob: outBlob, warnings, width, height, format: "png" };
  }

  // 3. WebP
  if (targetFormat === "webp") {
    return new Promise((resolve, reject) => {
      finalCanvas.toBlob(
        (outBlob) => {
          if (!outBlob) return reject(new Error("Failed to encode WebP image."));
          resolve({ blob: outBlob, warnings, width, height, format: "webp" });
        },
        "image/webp",
        quality
      );
    });
  }

  // 4. AVIF (Native browser check with fallback)
  if (targetFormat === "avif") {
    return new Promise((resolve) => {
      finalCanvas.toBlob(
        (outBlob) => {
          if (outBlob && outBlob.type === "image/avif") {
            resolve({ blob: outBlob, warnings, width, height, format: "avif" });
          } else {
            // Browser canvas does not support AVIF encoding; fallback to WebP
            warnings.push("Native browser canvas does not support AVIF encoding; optimized as high-efficiency WebP.");
            finalCanvas.toBlob(
              (webpBlob) => {
                resolve({
                  blob: webpBlob || new Blob([], { type: "image/webp" }),
                  warnings,
                  width,
                  height,
                  format: "webp",
                });
              },
              "image/webp",
              quality
            );
          }
        },
        "image/avif",
        quality
      );
    });
  }

  // 5. GIF (via gifenc 256-color palette quantization)
  if (targetFormat === "gif") {
    const ctx = finalCanvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    const imgData = ctx.getImageData(0, 0, width, height);

    const gif = GIFEncoder();
    const palette = quantize(imgData.data, 256);
    const index = applyPalette(imgData.data, palette);
    gif.writeFrame(index, width, height, { palette });
    gif.finish();

    const gifBytes = gif.bytes();
    const outBlob = new Blob([gifBytes as BlobPart], { type: "image/gif" });
    warnings.push("GIF is limited to 256 indexed colors.");
    return { blob: outBlob, warnings, width, height, format: "gif" };
  }

  // 6. BMP (via bmp-js with genuine Windows Bitmap DIB structure)
  if (targetFormat === "bmp") {
    const flatCanvas = flattenCanvasBackground(finalCanvas, opts.backgroundColor || "#ffffff");
    const ctx = flatCanvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    const imgData = ctx.getImageData(0, 0, width, height);

    // bmp-js expects ABGR buffer
    const bmpBuf = Buffer.alloc ? Buffer.alloc(imgData.data.length) : new Uint8Array(imgData.data.length);
    for (let i = 0; i < imgData.data.length; i += 4) {
      bmpBuf[i] = imgData.data[i + 3];     // A
      bmpBuf[i + 1] = imgData.data[i + 2]; // B
      bmpBuf[i + 2] = imgData.data[i + 1]; // G
      bmpBuf[i + 3] = imgData.data[i];     // R
    }
    const bmpResult = bmp.encode({
      data: bmpBuf,
      width,
      height,
    });
    const outBlob = new Blob([bmpResult.data as BlobPart], { type: "image/bmp" });
    warnings.push("BMP format does not support transparency; output flattened.");
    return { blob: outBlob, warnings, width, height, format: "bmp" };
  }

  // 7. ICO (Windows Icon standard: max 256x256, PNG-encapsulated with 22-byte ICO header)
  if (targetFormat === "ico") {
    let icoCanvas = finalCanvas;
    if (width > 256 || height > 256) {
      icoCanvas = document.createElement("canvas");
      icoCanvas.width = 256;
      icoCanvas.height = 256;
      const icoCtx = icoCanvas.getContext("2d");
      if (icoCtx) {
        icoCtx.drawImage(finalCanvas, 0, 0, 256, 256);
        warnings.push("ICO icon resized to 256×256 standard maximum.");
      }
    }
    const icoCtx = icoCanvas.getContext("2d")!;
    const icoImgData = icoCtx.getImageData(0, 0, icoCanvas.width, icoCanvas.height);
    const pngBytes = new Uint8Array(
      UPNG.encode([icoImgData.data.buffer], icoCanvas.width, icoCanvas.height, 0)
    );

    const wByte = icoCanvas.width >= 256 ? 0 : icoCanvas.width;
    const hByte = icoCanvas.height >= 256 ? 0 : icoCanvas.height;
    const icoHeader = new Uint8Array(22);
    const dv = new DataView(icoHeader.buffer);
    dv.setUint16(0, 0, true);   // Reserved
    dv.setUint16(2, 1, true);   // Type: 1 (ICO)
    dv.setUint16(4, 1, true);   // 1 image
    dv.setUint8(6, wByte);      // Width
    dv.setUint8(7, hByte);      // Height
    dv.setUint8(8, 0);          // Colors
    dv.setUint8(9, 0);          // Reserved
    dv.setUint16(10, 1, true);  // Color planes
    dv.setUint16(12, 32, true); // BPP
    dv.setUint32(14, pngBytes.length, true); // Image data size
    dv.setUint32(18, 22, true);              // Offset to image data

    const fullIco = new Uint8Array(icoHeader.length + pngBytes.length);
    fullIco.set(icoHeader, 0);
    fullIco.set(pngBytes, icoHeader.length);

    const outBlob = new Blob([fullIco as BlobPart], { type: "image/x-icon" });
    return { blob: outBlob, warnings, width: icoCanvas.width, height: icoCanvas.height, format: "ico" };
  }

  // 8. TIFF / TIF (via UTIF.encodeImage)
  if (targetFormat === "tiff" || targetFormat === "tif") {
    const ctx = finalCanvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    const imgData = ctx.getImageData(0, 0, width, height);
    const tiffBytes = UTIF.encodeImage(imgData.data, width, height);
    const outBlob = new Blob([tiffBytes as BlobPart], { type: "image/tiff" });
    return { blob: outBlob, warnings, width, height, format: "tiff" };
  }

  // Default fallback to PNG
  return new Promise((resolve, reject) => {
    finalCanvas.toBlob(
      (outBlob) => {
        if (!outBlob) return reject(new Error("Failed to encode image."));
        resolve({ blob: outBlob, warnings, width, height, format: "png" });
      },
      "image/png"
    );
  });
}
