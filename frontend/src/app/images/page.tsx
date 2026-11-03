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
  ZoomIn,
  Camera,
  MapPin,
  Calendar,
  Lock,
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

  useEffect(() => {
    if (files.length > 0 && !selectedMetaFile) {
      setSelectedMetaFile(files[0]);
    }
  }, [files, selectedMetaFile]);

  useEffect(() => {
    if (selectedMetaFile) {
      const url = URL.createObjectURL(selectedMetaFile.file);
      setPreviewUrl(url);
      void inspectMetadata(selectedMetaFile.file).then((meta) => {
        setMetaInfo(meta);
        if (meta?.width && !width) setWidth(meta.width);
        if (meta?.height && !height) setHeight(meta.height);
      });
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
      setMetaInfo(null);
    }
  }, [selectedMetaFile]);

  const handleWidthChange = (newW: number | undefined) => {
    setWidth(newW);
    if (lockAspect && metaInfo?.width && metaInfo?.height && newW) {
      const ratio = metaInfo.height / metaInfo.width;
      setHeight(Math.round(newW * ratio));
    }
  };

  const handleHeightChange = (newH: number | undefined) => {
    setHeight(newH);
    if (lockAspect && metaInfo?.width && metaInfo?.height && newH) {
      const ratio = metaInfo.width / metaInfo.height;
      setWidth(Math.round(newH * ratio));
    }
  };

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
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <ImageIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          Advanced Image Studio & Optimizer
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
          High-performance in-browser conversion, before/after preview, EXIF metadata stripping, resizing, and lossy/lossless compression.
        </p>
      </div>

      {files.length === 0 ? (
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
          description="Supports JPEG, PNG, WebP, AVIF, HEIC, TIFF, GIF, BMP, and SVG"
          showToolRecommendations={false}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Visual Image Preview & Staging Deck (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Visual Canvas / Preview Box */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden flex flex-col">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-bold text-slate-900 dark:text-white truncate">
                    {selectedMetaFile?.name || "Image Preview"}
                  </span>
                  {selectedMetaFile && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({formatBytes(selectedMetaFile.size)})
                    </span>
                  )}
                </div>
                {metaInfo?.width && metaInfo?.height && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                    {metaInfo.width} × {metaInfo.height} px
                  </span>
                )}
              </div>

              {/* Viewport */}
              <div className="p-4 bg-slate-100/70 dark:bg-slate-950 flex items-center justify-center min-h-[300px] max-h-[440px] overflow-hidden relative">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className={clsx(
                      "max-h-[380px] w-auto max-w-full object-contain rounded-lg shadow-sm transition-transform duration-200",
                      grayscale && "grayscale",
                      flipH && "-scale-x-100",
                      flipV && "-scale-y-100"
                    )}
                    style={{ transform: `rotate(${rotateAngle}deg)` }}
                  />
                ) : (
                  <div className="text-slate-400 text-xs flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    <span>Loading preview...</span>
                  </div>
                )}
              </div>

              {/* EXIF Metadata Strip */}
              {metaInfo && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Camera</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                      {metaInfo.make || metaInfo.model ? `${metaInfo.make || ""} ${metaInfo.model || ""}` : "Not tagged"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Capture Date</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                      {metaInfo.dateTime ? String(metaInfo.dateTime).split("T")[0] : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">GPS Geotag</span>
                    <span className={clsx(
                      "font-semibold block truncate",
                      (metaInfo.latitude != null || metaInfo.longitude != null) ? "text-amber-600 dark:text-amber-400" : "text-slate-500"
                    )}>
                      {(metaInfo.latitude != null || metaInfo.longitude != null) ? "Location Attached" : "None detected"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Exposure / ISO</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                      {metaInfo.iso ? `ISO ${metaInfo.iso}` : "sRGB / Standard"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Staged files deck */}
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
              showToolRecommendations={false}
            />
          </div>

          {/* Right Column: Studio Controls (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs p-5 space-y-4">
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                Target Format
              </span>
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {(["webp", "jpeg", "png", "avif", "bmp", "ico"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setTargetFormat(fmt)}
                    className={clsx(
                      "py-2 px-1.5 rounded-lg border text-center text-xs font-bold uppercase transition-all font-mono cursor-pointer",
                      targetFormat === fmt
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100 shadow-2xs"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    )}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Slider for lossy formats */}
            {["webp", "jpeg", "avif"].includes(targetFormat) && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">
                    Quality: {quality}%
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {quality >= 90 ? "Near Lossless" : quality >= 75 ? "Balanced Web" : "High Compression"}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-600 mt-1"
                />
              </div>
            )}

            {/* Resize Controls */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Dimensions (Resize)
                </label>
                <button
                  type="button"
                  onClick={() => setLockAspect(!lockAspect)}
                  className={clsx(
                    "text-[10px] font-semibold px-2 py-0.5 rounded cursor-pointer",
                    lockAspect
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  )}
                >
                  {lockAspect ? "Aspect Locked" : "Freeform"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Width (px)</span>
                  <input
                    type="number"
                    value={width || ""}
                    onChange={(e) => handleWidthChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    placeholder="Auto"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Height (px)</span>
                  <input
                    type="number"
                    value={height || ""}
                    onChange={(e) => handleHeightChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    placeholder="Auto"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Transforms: Rotate & Flips */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                Transforms & Filters
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setRotateAngle((prev) => (prev + 90) % 360)}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer",
                    rotateAngle > 0
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  )}
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Rotate {rotateAngle > 0 ? `(${rotateAngle}°)` : "+90°"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFlipH((prev) => !prev)}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer",
                    flipH
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  )}
                >
                  Flip H
                </button>

                <button
                  type="button"
                  onClick={() => setGrayscale((prev) => !prev)}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer",
                    grayscale
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  )}
                >
                  B&W Grayscale
                </button>
              </div>
            </div>

            {/* Privacy EXIF toggle */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">
                  Strip EXIF & Location
                </span>
                <span className="text-[10px] text-slate-400">
                  Wipes GPS and camera metadata
                </span>
              </div>
              <input
                type="checkbox"
                checked={stripMeta}
                onChange={(e) => setStripMeta(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Action Button */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleRunConversion}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Process & Optimize {files.length} Image(s)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
