"use client";

import { useState, useEffect, useRef } from "react";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { useQueue } from "@/stores/tasks";
import { runServerJob } from "@/lib/api";
import {
  convertAndOptimizeImage,
  inspectMetadata,
  type ImageMeta,
} from "@/lib/imageClient";
import { formatBytes, extOf } from "@/lib/fileTypes";
import {
  Image as ImageIcon,
  Minimize2,
  Crop,
  RotateCw,
  Sparkles,
  Play,
  Sliders,
  Shield,
  Eye,
  Trash2,
  Info,
  Check,
  AlertTriangle,
} from "lucide-react";
import clsx from "clsx";

export default function ImageStudioPage() {
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [targetFormat, setTargetFormat] = useState<"webp" | "jpeg" | "png" | "avif" | "bmp" | "ico">("webp");
  const [quality, setQuality] = useState<number>(85);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [lockAspect, setLockAspect] = useState(true);
  const [rotateAngle, setRotateAngle] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [grayscale, setGrayscale] = useState(false);
  const [stripMeta, setStripMeta] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");

  // Metadata inspector state
  const [selectedMetaFile, setSelectedMetaFile] = useState<StagedFile | null>(null);
  const [metaInfo, setMetaInfo] = useState<ImageMeta | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { enqueue, setDrawer } = useQueue();

  // Load preview & metadata when selecting a file
  useEffect(() => {
    if (files.length > 0 && !selectedMetaFile) {
      setSelectedMetaFile(files[0]);
    }
  }, [files, selectedMetaFile]);

  useEffect(() => {
    if (selectedMetaFile) {
      const url = URL.createObjectURL(selectedMetaFile.file);
      setPreviewUrl(url);
      void inspectMetadata(selectedMetaFile.file).then((meta) => setMetaInfo(meta));
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
      setMetaInfo(null);
    }
  }, [selectedMetaFile]);

  const handleRunConversion = () => {
    if (files.length === 0) return;

    enqueue(
      {
        title: `Convert to ${targetFormat.toUpperCase()}`,
        tool: "image-convert",
        kind: "convert",
        statKind: "convert",
      },
      files.map((f) => ({
        label: f.name,
        inputSize: f.size,
        engine: "local",
        run: async () => {
          const ext = extOf(f.name);
          // If HEIC or AVIF on browsers that lack native decoder, use server fallback
          const isHeic = ext === "heic" || ext === "heif";
          if (isHeic) {
            const serverRes = await runServerJob(
              "image.convert",
              [f.file],
              [f.name],
              {
                target: targetFormat,
                quality,
                width,
                height,
                keepMetadata: !stripMeta,
                background: backgroundColor,
              },
              new AbortController().signal,
              () => {}
            );
            return { outputs: serverRes.files, warnings: serverRes.warnings };
          }

          // Otherwise 100% private in-browser conversion
          const res = await convertAndOptimizeImage(f.file, {
            targetFormat,
            quality,
            width,
            height,
            rotate: rotateAngle,
            flipHorizontal: flipH,
            flipVertical: flipV,
            grayscale,
            backgroundColor,
            stripMetadata: stripMeta,
          });

          const base = f.name.slice(0, f.name.lastIndexOf(".")) || f.name;
          const extOut = targetFormat === "jpeg" ? "jpg" : targetFormat;
          return {
            outputs: [{ name: `${base}.${extOut}`, blob: res.blob }],
            warnings: res.warnings,
          };
        },
      }))
    );

    setDrawer(true);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <ImageIcon className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          Advanced Image Converter & Studio
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Convert, resize, crop, rotate, strip EXIF metadata, and optimize images across JPEG, PNG, WebP, AVIF, HEIC, TIFF, and SVG.
        </p>
      </div>

      <DropZone
        onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
        selectedFiles={files}
        onRemoveFile={(id) => {
          setFiles((prev) => prev.filter((f) => f.id !== id));
          if (selectedMetaFile?.id === id) setSelectedMetaFile(null);
        }}
        onClearAll={() => {
          setFiles([]);
          setSelectedMetaFile(null);
        }}
        accept="image/*,.heic,.heif,.tiff,.tif,.svg"
        title="Drop photos or images here"
        description="Supports JPEG, PNG, WebP, AVIF, HEIC, TIFF, GIF, BMP, SVG"
        showToolRecommendations={false}
      />

      {files.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Settings Column (7 cols) */}
          <div className="lg:col-span-7 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            {/* Target Format */}
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block mb-2">
                Target Format
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(["webp", "jpeg", "png", "avif", "bmp", "ico"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setTargetFormat(fmt)}
                    className={clsx(
                      "py-2.5 px-2 rounded-xl border text-center text-xs font-bold uppercase transition-all font-mono",
                      targetFormat === fmt
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Slider */}
            {["webp", "jpeg", "avif"].includes(targetFormat) && (
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="text-slate-700 dark:text-slate-300">
                    Compression Quality: {quality}%
                  </span>
                  <span className="text-slate-400">
                    {quality >= 90 ? "Near Lossless" : quality >= 75 ? "Balanced Web" : "High Compression"}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-600"
                />
              </div>
            )}

            {/* Transformations (Resize, Rotate, Grayscale) */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                Transformations & Filters
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRotateAngle((prev) => (prev + 90) % 360)}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors",
                    rotateAngle > 0
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  )}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Rotate {rotateAngle > 0 ? `(${rotateAngle}°)` : "+90°"}
                </button>

                <button
                  type="button"
                  onClick={() => setFlipH((prev) => !prev)}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors",
                    flipH
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  )}
                >
                  Flip Horizontal
                </button>

                <button
                  type="button"
                  onClick={() => setGrayscale((prev) => !prev)}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors",
                    grayscale
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  )}
                >
                  Grayscale (B&W)
                </button>
              </div>
            </div>

            {/* Privacy & EXIF Metadata toggle */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Strip EXIF & Location Metadata
                </span>
                <span className="text-[11px] text-slate-400">
                  Removes GPS coordinates, camera serial, and shooting timestamps for privacy.
                </span>
              </div>
              <input
                type="checkbox"
                checked={stripMeta}
                onChange={(e) => setStripMeta(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded-sm cursor-pointer"
              />
            </div>

            {/* Transparency Note */}
            {["jpeg", "bmp"].includes(targetFormat) && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {targetFormat.toUpperCase()} does not support transparent backgrounds. Transparent areas will be filled with white.
                </span>
              </div>
            )}

            <button
              onClick={handleRunConversion}
              className="w-full py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Convert {files.length} Image(s)</span>
            </button>
          </div>

          {/* Live Preview & Metadata Inspector (5 cols) */}
          <div className="lg:col-span-5 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-emerald-500" />
                  Image Inspector
                </span>
                {selectedMetaFile && (
                  <span className="text-xs font-mono text-slate-400">
                    {formatBytes(selectedMetaFile.size)}
                  </span>
                )}
              </div>

              {/* Preview Window */}
              <div className="mt-4 rounded-2xl bg-slate-100 dark:bg-slate-800 h-48 flex items-center justify-center overflow-hidden border border-slate-200/60 dark:border-slate-700/60 relative">
                {previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400">No image selected</span>
                )}
              </div>

              {/* EXIF Data List */}
              <div className="mt-4 space-y-2 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px] uppercase tracking-wider">
                  Metadata & Hardware Details
                </span>
                {metaInfo ? (
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400">
                    {metaInfo.make && (
                      <div className="flex justify-between">
                        <span>Camera:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{metaInfo.make} {metaInfo.model}</span>
                      </div>
                    )}
                    {metaInfo.dateTime && (
                      <div className="flex justify-between">
                        <span>Date Captured:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{metaInfo.dateTime}</span>
                      </div>
                    )}
                    {metaInfo.iso && (
                      <div className="flex justify-between">
                        <span>ISO / Exposure:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">ISO {metaInfo.iso} · {metaInfo.exposureTime}s</span>
                      </div>
                    )}
                    {metaInfo.latitude && metaInfo.longitude ? (
                      <div className="flex justify-between text-rose-600 dark:text-rose-400 font-semibold">
                        <span>GPS Coordinates:</span>
                        <span>{metaInfo.latitude.toFixed(4)}, {metaInfo.longitude.toFixed(4)}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> No GPS location embedded
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 py-2">
                    No EXIF tags found in this file (or already clean).
                  </div>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span>Conversions execute 100% locally in your browser.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
