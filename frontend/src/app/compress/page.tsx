"use client";

import { useState } from "react";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { useQueue } from "@/stores/tasks";
import { runServerJob } from "@/lib/api";
import { convertAndOptimizeImage } from "@/lib/imageClient";
import { createZip } from "@/lib/archiveClient";
import { formatBytes, extOf } from "@/lib/fileTypes";
import {
  Minimize2,
  Play,
  TrendingDown,
  Layers,
  Sparkles,
  CheckCircle2,
  Shield,
  Sliders,
  Cpu,
} from "lucide-react";
import clsx from "clsx";

type CompressionTier = "low" | "balanced" | "max";

export default function FileCompressorPage() {
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [tier, setTier] = useState<CompressionTier>("balanced");
  const { enqueue, setDrawer } = useQueue();

  const handleRunCompression = () => {
    if (files.length === 0) return;

    enqueue(
      {
        title: `Compress (${tier.toUpperCase()} Tier)`,
        tool: "compress",
        kind: "compress",
        statKind: "compress",
      },
      files.map((f) => ({
        label: f.name,
        inputSize: f.size,
        engine: extOf(f.name) === "pdf" ? "server" : "local",
        run: async (ctx) => {
          const ext = extOf(f.name);

          // 1. PDF -> Use PyMuPDF rewrite_images engine
          if (ext === "pdf") {
            const res = await runServerJob("pdf.compress", [f.file], [f.name], { level: tier }, ctx.signal, (p, s) =>
              ctx.progress(p, s)
            );
            return { outputs: res.files, warnings: res.warnings };
          }

          // 2. Images -> In-browser high-efficiency compression
          if (["jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif", "heic", "heif", "gif"].includes(ext)) {
            const quality = tier === "low" ? 90 : tier === "balanced" ? 75 : 55;
            const targetFormat =
              ext === "heic" || ext === "heif" || (ext === "png" && tier === "max")
                ? "webp"
                : ext === "tif"
                ? "tiff"
                : (ext as any);

            const res = await convertAndOptimizeImage(f.file, {
              targetFormat,
              quality,
              stripMetadata: true,
            });

            const base = f.name.slice(0, f.name.lastIndexOf(".")) || f.name;
            const outExt = targetFormat === "jpeg" ? "jpg" : targetFormat;
            const outName = `${base}-compressed.${outExt}`;

            return {
              outputs: [
                {
                  name: outName,
                  blob: res.blob,
                  note: `${res.width}×${res.height} px · ${formatBytes(res.blob.size)}`,
                },
              ],
              warnings: res.warnings,
            };
          }

          // 3. Fallback / generic data -> ZIP compress
          const zipBlob = await createZip(
            [{ name: f.name, blob: f.file }],
            "DEFLATE",
            (p, s) => ctx.progress(p, s)
          );
          return {
            outputs: [{ name: `${f.name}.zip`, blob: zipBlob, note: "Deflate compressed archive" }],
          };
        },
      }))
    );

    setDrawer(true);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-150">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <Minimize2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          Multi-Tier File Compressor
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Intelligent size reduction across PDF documents, high-res images, Office presentations, and archives.
        </p>
      </div>

      {files.length === 0 ? (
        <DropZone
          onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
          selectedFiles={files}
          onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
          onClearAll={() => setFiles([])}
          title="Drop PDF, image, or office files here to compress"
          description="Supports PDF, JPEG, PNG, WebP, Word, PPTX, and generic documents"
          showToolRecommendations={false}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Staged Files Column */}
          <div className="lg:col-span-5 space-y-3">
            <DropZone
              onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
              selectedFiles={files}
              onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
              onClearAll={() => setFiles([])}
              showToolRecommendations={false}
            />
          </div>

          {/* Settings Column */}
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs p-5 sm:p-6 space-y-5">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block mb-2">
                Compression Profile
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    id: "low",
                    name: "Low",
                    estimate: "~20-40% smaller",
                    desc: "Preserves sharp detail. 200 DPI downsampling / 90% quality.",
                  },
                  {
                    id: "balanced",
                    name: "Balanced",
                    estimate: "~50-70% smaller",
                    desc: "Optimal balance between small size and visual fidelity (144 DPI).",
                  },
                  {
                    id: "max",
                    name: "Maximum",
                    estimate: "~75-90% smaller",
                    desc: "Aggressive reduction for email attachments and web caps (96 DPI).",
                  },
                ].map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setTier(lvl.id as any)}
                    className={clsx(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                      tier === lvl.id
                        ? "border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 text-purple-950 dark:text-purple-100 font-bold shadow-2xs"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    )}
                  >
                    <div>
                      <div className="font-bold text-xs">{lvl.name}</div>
                      <div className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 mt-0.5">
                        {lvl.estimate}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                      {lvl.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-500" />
                <span>PyMuPDF Stream Cleaning & Canvas Engine</span>
              </div>
              <button
                onClick={handleRunCompression}
                className="py-2.5 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Compress {files.length} File(s)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
