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

          // 2. Images -> In-browser canvas/WebP compression
          if (["jpg", "jpeg", "png", "webp", "bmp"].includes(ext)) {
            const quality = tier === "low" ? 90 : tier === "balanced" ? 75 : 55;
            const res = await convertAndOptimizeImage(f.file, {
              targetFormat: ext === "png" && tier === "max" ? "webp" : (ext as any),
              quality,
              stripMetadata: true,
            });
            const outName = ext === "png" && tier === "max"
              ? f.name.replace(".png", "-compressed.webp")
              : f.name.replace(`.${ext}`, `-compressed.${ext}`);

            return {
              outputs: [{ name: outName, blob: res.blob }],
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
            outputs: [{ name: `${f.name}.zip`, blob: zipBlob, note: "Deflate compressed ZIP" }],
          };
        },
      }))
    );

    setDrawer(true);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <Minimize2 className="w-7 h-7 text-purple-600 dark:text-purple-400" />
          Advanced File Compressor
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Intelligent multi-tier size reduction for PDFs, images, Office documents, and archives.
        </p>
      </div>

      <DropZone
        onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
        selectedFiles={files}
        onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
        onClearAll={() => setFiles([])}
        title="Drop files to compress"
        description="Supports PDF, JPEG, PNG, WebP, Office files, and generic documents"
        showToolRecommendations={false}
      />

      {files.length > 0 && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block mb-2">
              Select Compression Profile
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: "low",
                  name: "Low Compression",
                  desc: "Prioritizes crisp visual clarity. Downsamples to 200 DPI / 90% quality.",
                },
                {
                  id: "balanced",
                  name: "Balanced (Recommended)",
                  desc: "Optimal balance between small file size and good visual fidelity (144 DPI).",
                },
                {
                  id: "max",
                  name: "Maximum Compression",
                  desc: "Aggressive reduction for email attachments and strict web size caps (96 DPI).",
                },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setTier(lvl.id as any)}
                  className={clsx(
                    "p-4 rounded-2xl border text-left transition-all",
                    tier === lvl.id
                      ? "border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 text-purple-950 dark:text-purple-100 font-bold shadow-xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  )}
                >
                  <div className="font-bold text-sm">{lvl.name}</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {lvl.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleRunCompression}
              className="w-full py-3 px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Compress {files.length} File(s)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
