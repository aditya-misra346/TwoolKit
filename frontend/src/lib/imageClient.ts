/**
 * Client-Side Image Converter, Editor, Optimizer, and Metadata Inspector.
 * Uses HTML5 Canvas, UTIF for TIFF decoding, and exifr for metadata inspection.
 */

import exifr from "exifr";
import UTIF from "utif2";

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

export interface ImageConvertOptions extends ImageEditOptions {
  targetFormat: "jpeg" | "png" | "webp" | "bmp" | "ico" | "avif" | "gif";
  quality?: number; // 1..100
  backgroundColor?: string; // Hex for flattening alpha, e.g. "#ffffff"
  stripMetadata?: boolean;
}

/** Decode any image Blob (including TIFF and SVG) into an HTMLCanvasElement */
export async function decodeToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const fileName = (blob as File).name?.toLowerCase() || "";
  const isTiff = blob.type.includes("tiff") || fileName.endsWith(".tif") || fileName.endsWith(".tiff");

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

  // Standard formats (PNG, JPEG, WebP, GIF, SVG, BMP)
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

/** Extract EXIF and camera metadata */
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
      dateTime: exifData.DateTimeOriginal?.toString() || exifData.CreateDate?.toString(),
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
    cropped.width = opts.crop.width;
    cropped.height = opts.crop.height;
    const ctx = cropped.getContext("2d");
    if (ctx) {
      ctx.drawImage(
        curCanvas,
        opts.crop.x,
        opts.crop.y,
        opts.crop.width,
        opts.crop.height,
        0,
        0,
        opts.crop.width,
        opts.crop.height
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
  const rotation = ((opts.rotate || 0) % 360 + 360) % 360;
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

        // Grayscale: 0.299R + 0.587G + 0.114B
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

/** Process and convert an image, returning the generated Blob and any warnings */
export async function convertAndOptimizeImage(
  blob: Blob,
  opts: ImageConvertOptions
): Promise<{ blob: Blob; warnings: string[]; width: number; height: number }> {
  const warnings: string[] = [];
  const rawCanvas = await decodeToCanvas(blob);
  const finalCanvas = applyImageEdits(rawCanvas, opts);

  const targetFormat = opts.targetFormat.toLowerCase();
  const quality = Math.max(0.01, Math.min(1.0, (opts.quality ?? 85) / 100));

  let mime = "image/png";
  if (targetFormat === "jpeg" || targetFormat === "jpg") mime = "image/jpeg";
  else if (targetFormat === "webp") mime = "image/webp";
  else if (targetFormat === "bmp") mime = "image/bmp";
  else if (targetFormat === "ico") mime = "image/x-icon";

  // Check if flattening is required (e.g. JPEG or BMP do not support transparency)
  let exportCanvas = finalCanvas;
  if (mime === "image/jpeg" || mime === "image/bmp") {
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = finalCanvas.width;
    bgCanvas.height = finalCanvas.height;
    const bgCtx = bgCanvas.getContext("2d");
    if (bgCtx) {
      bgCtx.fillStyle = opts.backgroundColor || "#ffffff";
      bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
      bgCtx.drawImage(finalCanvas, 0, 0);
      exportCanvas = bgCanvas;
      warnings.push(`${targetFormat.toUpperCase()} does not support transparency; transparent areas were filled with ${opts.backgroundColor || "white"}.`);
    }
  }

  // Handle ICO format scaling
  if (targetFormat === "ico") {
    if (exportCanvas.width > 256 || exportCanvas.height > 256) {
      const icoCanvas = document.createElement("canvas");
      icoCanvas.width = 256;
      icoCanvas.height = 256;
      const icoCtx = icoCanvas.getContext("2d");
      if (icoCtx) {
        icoCtx.drawImage(exportCanvas, 0, 0, 256, 256);
        exportCanvas = icoCanvas;
        warnings.push("ICO format resized to standard 256x256 icon dimensions.");
      }
    }
  }

  return new Promise((resolve, reject) => {
    exportCanvas.toBlob(
      (outBlob) => {
        if (!outBlob) return reject(new Error(`Failed to encode image as ${targetFormat.toUpperCase()}.`));
        resolve({
          blob: outBlob,
          warnings,
          width: exportCanvas.width,
          height: exportCanvas.height,
        });
      },
      mime,
      quality
    );
  });
}
