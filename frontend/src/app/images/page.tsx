"use client";

import { useState, useEffect, useRef, useTransition, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { useQueue } from "@/stores/tasks";
import { runServerJob } from "@/lib/api";
import {
  convertAndOptimizeImage,
  inspectMetadata,
  calculateReduction,
  type ImageMeta,
  type SupportedTargetFormat,
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
  Camera,
  MapPin,
  Calendar,
  Lock,
  FolderUp,
  Download,
  RefreshCw,
  Columns,
  Layers,
  Settings2,
  CheckCircle2,
  Maximize2,
  ArrowRight,
  SunMedium,
  Contrast,
  SlidersHorizontal,
} from "lucide-react";
import clsx from "clsx";

type ImageStudioTab = "convert" | "compress" | "edit" | "metadata";

function ImageStudioContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Active workspace tab
  const toolParam = searchParams.get("tool");
  const initialTab: ImageStudioTab =
    toolParam === "compress"
      ? "compress"
      : toolParam === "edit"
      ? "edit"
      : toolParam === "metadata"
      ? "metadata"
      : "convert";

  const [activeTab, setActiveTab] = useState<ImageStudioTab>(initialTab);

  // File management
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<StagedFile | null>(null);

  // Target format & quality
  const [targetFormat, setTargetFormat] = useState<SupportedTargetFormat>("webp");
  const [quality, setQuality] = useState<number>(85);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");

  // Edit transformations
  const [width, setWidth] = useState<number | undefined>(undefined);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [lockAspect, setLockAspect] = useState(true);
  const [scalePercent, setScalePercent] = useState<number>(100);
  const [rotateAngle, setRotateAngle] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [grayscale, setGrayscale] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [cropPreset, setCropPreset] = useState<"original" | "1:1" | "16:9" | "4:3" | "9:16">("original");

  // Privacy & Metadata
  const [stripMeta, setStripMeta] = useState(true);
  const [metaInfo, setMetaInfo] = useState<ImageMeta | null>(null);

  // Live Previews & Comparison
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [processedPreviewUrl, setProcessedPreviewUrl] = useState<string | null>(null);
  const [processedSize, setProcessedSize] = useState<number | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [compareMode, setCompareMode] = useState<"split" | "side" | "single">("split");
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  const { enqueue, setDrawer } = useQueue();
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Keep activeTab in sync with query param changes
  useEffect(() => {
    if (toolParam === "compress" || toolParam === "edit" || toolParam === "metadata" || toolParam === "convert") {
      setActiveTab(toolParam);
    }
  }, [toolParam]);

  // Sync selected file
  useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      setSelectedFile(files[0]);
    }
  }, [files, selectedFile]);

  // Inspect metadata and generate original preview
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile.file);
      setOriginalPreviewUrl(url);

      void inspectMetadata(selectedFile.file).then((meta) => {
        setMetaInfo(meta);
        if (meta?.width) setWidth(meta.width);
        if (meta?.height) setHeight(meta.height);
      });

      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setOriginalPreviewUrl(null);
      setMetaInfo(null);
      setWidth(undefined);
      setHeight(undefined);
    }
  }, [selectedFile]);

  // Generate live processed preview on setting changes (debounced)
  useEffect(() => {
    if (!selectedFile) {
      setProcessedPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setProcessedSize(null);
      setProcessedBlob(null);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsGeneratingPreview(true);
      try {
        const res = await convertAndOptimizeImage(selectedFile.file, {
          targetFormat,
          quality,
          width,
          height,
          rotate: rotateAngle,
          flipHorizontal: flipH,
          flipVertical: flipV,
          grayscale,
          brightness,
          contrast,
          backgroundColor,
          stripMetadata: stripMeta,
        });

        if (isMounted) {
          const url = URL.createObjectURL(res.blob);
          setProcessedPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
          setProcessedSize(res.blob.size);
          setProcessedBlob(res.blob);
        }
      } catch (e) {
        console.warn("Live preview generation:", e);
      } finally {
        if (isMounted) setIsGeneratingPreview(false);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    selectedFile,
    targetFormat,
    quality,
    width,
    height,
    rotateAngle,
    flipH,
    flipV,
    grayscale,
    brightness,
    contrast,
    backgroundColor,
    stripMeta,
  ]);

  // Aspect ratio locking helper
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

  const handleScalePercent = (pct: number) => {
    setScalePercent(pct);
    if (metaInfo?.width && metaInfo?.height) {
      setWidth(Math.round((metaInfo.width * pct) / 100));
      setHeight(Math.round((metaInfo.height * pct) / 100));
    }
  };

  // Folder selection helper
  const handleSelectFolder = async () => {
    if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const folderFiles: File[] = [];

        async function readDir(handle: any, curPath: string) {
          for await (const entry of handle.values()) {
            if (entry.kind === "file") {
              const file = await entry.getFile();
              folderFiles.push(file);
            } else if (entry.kind === "directory") {
              await readDir(entry, `${curPath}/${entry.name}`);
            }
          }
        }

        await readDir(dirHandle, dirHandle.name);
        const staged: StagedFile[] = folderFiles.map((file) => ({
          id: `${file.name}_${file.size}_${file.lastModified}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          size: file.size,
          file,
          category: "image",
          extension: extOf(file.name),
        }));
        setFiles((prev) => [...prev, ...staged]);
        return;
      } catch {
        // Fallback to file input
      }
    }
    folderInputRef.current?.click();
  };

  // Run the batch execution
  const handleExecuteBatch = () => {
    if (files.length === 0) return;

    enqueue(
      {
        title: `Process & Optimize (${targetFormat.toUpperCase()})`,
        tool: "image-convert",
        kind: "convert",
        statKind: "convert",
      },
      files.map((f) => ({
        label: f.name,
        inputSize: f.size,
        engine: "local",
        run: async (ctx) => {
          ctx.progress(0.2, "Decoding image stream");
          const ext = extOf(f.name);
          const isHeic = ext === "heic" || ext === "heif";

          try {
            ctx.progress(0.5, "Applying transformations and encoding");
            const res = await convertAndOptimizeImage(f.file, {
              targetFormat,
              quality,
              width,
              height,
              rotate: rotateAngle,
              flipHorizontal: flipH,
              flipVertical: flipV,
              grayscale,
              brightness,
              contrast,
              backgroundColor,
              stripMetadata: stripMeta,
            });

            ctx.progress(1.0, "Conversion complete");
            const base = f.name.slice(0, f.name.lastIndexOf(".")) || f.name;
            const extOut = targetFormat === "jpeg" ? "jpg" : targetFormat;
            return {
              outputs: [
                {
                  name: `${base}.${extOut}`,
                  blob: res.blob,
                  note: `${res.width}×${res.height} px · ${formatBytes(res.blob.size)}`,
                },
              ],
              warnings: res.warnings,
            };
          } catch (err: any) {
            // Failover to backend if server is accessible
            if (isHeic) {
              ctx.progress(0.6, "Trying high-compatibility server image engine");
              try {
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
                  ctx.signal,
                  (p, s) => ctx.progress(p, s)
                );
                return { outputs: serverRes.files, warnings: serverRes.warnings };
              } catch (serverErr) {
                throw err;
              }
            }
            throw err;
          }
        },
      }))
    );

    setDrawer(true);
  };

  // Reduction stats calculation
  const reduction =
    selectedFile && processedSize != null
      ? calculateReduction(selectedFile.size, processedSize)
      : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
      {/* Top Header & Tool Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <ImageIcon className="w-7 h-7 text-emerald-600 dark:text-emerald-400 shrink-0" />
            Advanced Image Studio & Optimizer
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-300 mt-1.5">
            Certified in-browser conversion, live before/after comparison, EXIF stripping, and precision compression.
          </p>
        </div>

        {/* Studio Mode Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 self-start lg:self-auto">
          {[
            { id: "convert", label: "Format Converter", icon: RefreshCw },
            { id: "compress", label: "Compressor", icon: Minimize2 },
            { id: "edit", label: "Resize & Edit", icon: Crop },
            { id: "metadata", label: "EXIF & GPS", icon: Camera },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as ImageStudioTab);
                  router.replace(`/images?tool=${tab.id}`, { scroll: false });
                }}
                className={clsx(
                  "px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer",
                  isActive
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Icon className={clsx("w-4 h-4", isActive && "text-emerald-600 dark:text-emerald-400")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Layout */}
      {files.length === 0 ? (
        <div className="space-y-4">
          <DropZone
            onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
            selectedFiles={files}
            onRemoveFile={(id) => {
              setFiles((prev) => prev.filter((f) => f.id !== id));
              if (selectedFile?.id === id) setSelectedFile(null);
            }}
            onClearAll={() => {
              setFiles([]);
              setSelectedFile(null);
            }}
            accept="image/*,.heic,.heif,.tiff,.tif,.svg,.bmp,.ico"
            title="Drop images, photos, or full folders here"
            description="Supports JPEG, PNG, WebP, AVIF, HEIC, TIFF, GIF, BMP, and SVG with genuine format encoding"
            showToolRecommendations={false}
          />

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleSelectFolder}
              className="py-2.5 px-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold text-xs shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all flex items-center gap-2 cursor-pointer"
            >
              <FolderUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Select Entire Image Folder</span>
            </button>
            <input
              type="file"
              ref={folderInputRef}
              onChange={(e) => {
                if (e.target.files) {
                  const folderFiles: StagedFile[] = Array.from(e.target.files).map((file) => ({
                    id: `${file.name}_${file.size}_${file.lastModified}_${Math.random().toString(36).slice(2, 6)}`,
                    name: file.name,
                    size: file.size,
                    file,
                    category: "image",
                    extension: extOf(file.name),
                  }));
                  setFiles((prev) => [...prev, ...folderFiles]);
                }
              }}
              // @ts-expect-error - webkitdirectory and directory are browser-specific folder upload attributes
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Interactive Before/After Deck & Staged Files (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Visual Canvas / Preview Box */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden flex flex-col">
              {/* Preview Bar Controls */}
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-bold text-slate-900 dark:text-white truncate">
                    {selectedFile?.name || "Image Preview"}
                  </span>
                  {selectedFile && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({formatBytes(selectedFile.size)})
                    </span>
                  )}
                </div>

                {/* Comparison View Mode Selector */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
                  <button
                    onClick={() => setCompareMode("split")}
                    className={clsx(
                      "px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer",
                      compareMode === "split"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                    title="Split Comparison Slider"
                  >
                    Split Slider
                  </button>
                  <button
                    onClick={() => setCompareMode("side")}
                    className={clsx(
                      "px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer",
                      compareMode === "side"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                    title="Side-by-Side Dual View"
                  >
                    Side by Side
                  </button>
                  <button
                    onClick={() => setCompareMode("single")}
                    className={clsx(
                      "px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer",
                      compareMode === "single"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                    title="Output Only"
                  >
                    Processed
                  </button>
                </div>
              </div>

              {/* Viewport Box */}
              <div className="p-4 bg-slate-100/70 dark:bg-slate-950 flex items-center justify-center min-h-[320px] max-h-[440px] overflow-hidden relative select-none">
                {compareMode === "split" && originalPreviewUrl && processedPreviewUrl ? (
                  // Draggable Split Slider Mode
                  <div className="relative max-h-[380px] w-full flex items-center justify-center overflow-hidden">
                    <div className="relative max-h-[380px] overflow-hidden rounded-lg shadow-sm">
                      {/* Original (Underneath) */}
                      <img
                        src={originalPreviewUrl}
                        alt="Original"
                        className="max-h-[380px] w-auto max-w-full object-contain block"
                      />

                      {/* Processed (Clipped Overlay) */}
                      <div
                        className="absolute inset-0 overflow-hidden"
                        style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
                      >
                        <img
                          src={processedPreviewUrl}
                          alt="Processed"
                          className="max-h-[380px] w-auto max-w-full object-contain block"
                        />
                      </div>

                      {/* Divider Line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
                        style={{ left: `${sliderPos}%` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white dark:bg-slate-900 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-200">
                          ⇄
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[9px] font-mono text-white">
                        ORIGINAL
                      </div>
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-emerald-600/80 backdrop-blur-xs text-[9px] font-mono text-white">
                        PROCESSED
                      </div>
                    </div>

                    {/* Draggable slider range */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sliderPos}
                      onChange={(e) => setSliderPos(parseFloat(e.target.value))}
                      className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full z-10"
                    />
                  </div>
                ) : compareMode === "side" && originalPreviewUrl && processedPreviewUrl ? (
                  // Side-by-Side Dual View
                  <div className="grid grid-cols-2 gap-3 w-full max-h-[380px]">
                    <div className="flex flex-col items-center justify-center bg-slate-200/50 dark:bg-slate-900 rounded-lg p-2 relative">
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-mono text-white">
                        ORIGINAL ({formatBytes(selectedFile?.size || 0)})
                      </span>
                      <img
                        src={originalPreviewUrl}
                        alt="Original"
                        className="max-h-[320px] w-auto max-w-full object-contain rounded"
                      />
                    </div>
                    <div className="flex flex-col items-center justify-center bg-slate-200/50 dark:bg-slate-900 rounded-lg p-2 relative">
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-emerald-600/80 text-[9px] font-mono text-white">
                        PROCESSED ({formatBytes(processedSize || 0)})
                      </span>
                      <img
                        src={processedPreviewUrl}
                        alt="Processed"
                        className="max-h-[320px] w-auto max-w-full object-contain rounded"
                      />
                    </div>
                  </div>
                ) : (
                  // Single Processed View
                  <div className="relative flex items-center justify-center max-h-[380px]">
                    {processedPreviewUrl ? (
                      <img
                        src={processedPreviewUrl}
                        alt="Processed Preview"
                        className="max-h-[380px] w-auto max-w-full object-contain rounded-lg shadow-sm"
                      />
                    ) : originalPreviewUrl ? (
                      <img
                        src={originalPreviewUrl}
                        alt="Original Preview"
                        className="max-h-[380px] w-auto max-w-full object-contain rounded-lg shadow-sm opacity-80"
                      />
                    ) : (
                      <div className="text-slate-400 text-xs flex items-center gap-2">
                        <ImageIcon className="w-5 h-5" />
                        <span>Loading preview...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Statistics & Reduction Bar */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  {metaInfo?.width && metaInfo?.height && (
                    <div className="text-[11px] font-mono text-slate-500">
                      <span className="text-slate-400">Dimensions: </span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {metaInfo.width}×{metaInfo.height} px
                      </strong>
                    </div>
                  )}
                  {selectedFile && processedSize != null && (
                    <div className="text-[11px] font-mono">
                      <span className="text-slate-400">Size: </span>
                      <span className="text-slate-500">{formatBytes(selectedFile.size)}</span>
                      <span className="text-slate-400 mx-1">→</span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {formatBytes(processedSize)}
                      </strong>
                    </div>
                  )}
                </div>

                {reduction && (
                  <div className="flex items-center gap-1.5">
                    {reduction.isSmaller ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>-{reduction.percent}% ({formatBytes(reduction.savedBytes)} saved)</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[11px]">
                        Already highly compressed
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Staged files deck with folder add support */}
            <DropZone
              onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
              selectedFiles={files}
              onRemoveFile={(id) => {
                setFiles((prev) => prev.filter((f) => f.id !== id));
                if (selectedFile?.id === id) setSelectedFile(null);
              }}
              onClearAll={() => {
                setFiles([]);
                setSelectedFile(null);
              }}
              accept="image/*,.heic,.heif,.tiff,.tif,.svg,.bmp,.ico"
              showToolRecommendations={false}
            />
          </div>

          {/* Right Column: Dynamic Settings for the Selected Studio Mode (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{activeTab === "convert" ? "Format Settings" : activeTab === "compress" ? "Compression Profile" : activeTab === "edit" ? "Transforms & Sizing" : "Metadata & Privacy"}</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {files.length} image(s) staged
              </span>
            </div>

            {/* 1. Format Converter Tab */}
            {activeTab === "convert" && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Target Output Format:
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "webp", label: "WEBP", desc: "Lightweight" },
                      { id: "jpeg", label: "JPEG", desc: "Universal" },
                      { id: "png", label: "PNG", desc: "Lossless" },
                      { id: "avif", label: "AVIF", desc: "Next-gen" },
                      { id: "gif", label: "GIF", desc: "Indexed" },
                      { id: "bmp", label: "BMP", desc: "Bitmap" },
                      { id: "ico", label: "ICO", desc: "Favicon" },
                      { id: "tiff", label: "TIFF", desc: "Archival" },
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setTargetFormat(fmt.id as SupportedTargetFormat)}
                        className={clsx(
                          "py-2 px-1.5 rounded-lg border text-center transition-all cursor-pointer",
                          targetFormat === fmt.id
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100 font-bold shadow-2xs"
                            : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                        )}
                      >
                        <div className="text-xs font-mono font-bold">{fmt.label}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{fmt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quality Slider for lossy formats */}
                {["webp", "jpeg", "avif", "png"].includes(targetFormat) && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300">
                        Encoding Quality: {quality}%
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {quality >= 90 ? "Maximum Fidelity" : quality >= 75 ? "Balanced Size" : "High Compression"}
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

                {/* Background color for formats without transparency */}
                {["jpeg", "bmp"].includes(targetFormat) && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                        Transparency Fill Color
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Fills transparent alpha areas
                      </span>
                    </div>
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 2. Compressor Tab */}
            {activeTab === "compress" && (
              <div className="space-y-4">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Compression Preset:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "balanced", label: "Balanced", q: 80, fmt: "webp", desc: "~50-65% smaller" },
                    { id: "max", label: "Max Shrink", q: 55, fmt: "webp", desc: "~75-90% smaller" },
                    { id: "lossless", label: "Lossless", q: 98, fmt: "png", desc: "No quality loss" },
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => {
                        setQuality(tier.q);
                        setTargetFormat(tier.fmt as SupportedTargetFormat);
                      }}
                      className={clsx(
                        "p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer",
                        quality === tier.q
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 font-bold"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      )}
                    >
                      <div className="font-bold">{tier.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{tier.desc}</div>
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700 dark:text-slate-300">
                      Fine-Tune Compression: {quality}%
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                      Format: {targetFormat.toUpperCase()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-600"
                  />
                </div>
              </div>
            )}

            {/* 3. Resize & Edit Tab */}
            {activeTab === "edit" && (
              <div className="space-y-4">
                {/* Dimensions */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Dimensions:
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
                        placeholder="Width"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Height (px)</span>
                      <input
                        type="number"
                        value={height || ""}
                        onChange={(e) => handleHeightChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                        placeholder="Height"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Percentage Quick Scaling */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {[25, 50, 75, 100, 150].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleScalePercent(pct)}
                        className={clsx(
                          "px-2 py-1 rounded-md text-[10px] font-mono border transition-colors cursor-pointer",
                          scalePercent === pct
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold"
                            : "border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800"
                        )}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transforms */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Orientation & Flips:
                  </span>
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
                      Flip Horizontal
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlipV((prev) => !prev)}
                      className={clsx(
                        "px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer",
                        flipV
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      )}
                    >
                      Flip Vertical
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      B&W Grayscale Filter:
                    </span>
                    <input
                      type="checkbox"
                      checked={grayscale}
                      onChange={(e) => setGrayscale(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
                      <span>Brightness: {brightness > 0 ? `+${brightness}` : brightness}</span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={brightness}
                      onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                      className="w-full accent-emerald-600"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
                      <span>Contrast: {contrast > 0 ? `+${contrast}` : contrast}</span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={contrast}
                      onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                      className="w-full accent-emerald-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. Metadata Tab */}
            {activeTab === "metadata" && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                    Embedded EXIF Information
                  </span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-slate-400">Camera Device:</span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {metaInfo?.make || metaInfo?.model ? `${metaInfo?.make || ""} ${metaInfo?.model || ""}` : "None detected"}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-slate-400">Capture Date:</span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {metaInfo?.dateTime ? String(metaInfo.dateTime).split("T")[0] : "—"}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-slate-400">GPS Coordinates:</span>
                      {metaInfo?.latitude != null && metaInfo?.longitude != null ? (
                        <a
                          href={`https://maps.google.com/?q=${metaInfo.latitude},${metaInfo.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-600 dark:text-amber-400 font-semibold underline hover:text-amber-700"
                        >
                          {metaInfo.latitude.toFixed(4)}°, {metaInfo.longitude.toFixed(4)}°
                        </a>
                      ) : (
                        <span className="text-slate-500">None</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-400">ISO / Exposure:</span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {metaInfo?.iso ? `ISO ${metaInfo.iso}` : "sRGB / Standard"}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Privacy Strip Toggle */}
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-emerald-900 dark:text-emerald-100 block">
                      Wipe EXIF & GPS Location
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      Permanently strips location and camera tags
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={stripMeta}
                    onChange={(e) => setStripMeta(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <button
                onClick={handleExecuteBatch}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>
                  Process & Export {files.length} Image(s)
                </span>
              </button>
              {processedBlob && (
                <button
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(processedBlob);
                    const base = selectedFile?.name.slice(0, selectedFile.name.lastIndexOf(".")) || "image";
                    const extOut = targetFormat === "jpeg" ? "jpg" : targetFormat;
                    a.download = `${base}-optimized.${extOut}`;
                    a.click();
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Download Processed Image</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImageStudioPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 text-xs">Loading Studio...</div>}>
      <ImageStudioContent />
    </Suspense>
  );
}
