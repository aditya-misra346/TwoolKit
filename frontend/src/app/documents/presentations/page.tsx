"use client";

import { useState } from "react";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { useQueue } from "@/stores/tasks";
import { runServerJob } from "@/lib/api";
import { extOf } from "@/lib/fileTypes";
import {
  Presentation,
  Video,
  Images,
  FileType2,
  Play,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

export default function PresentationStudioPage() {
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [outputMode, setOutputMode] = useState<"pdf" | "images" | "video">("pdf");
  const [imageFormat, setImageFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [secondsPerSlide, setSecondsPerSlide] = useState(3);
  const [videoWidth, setVideoWidth] = useState(1920);
  const { enqueue, setDrawer } = useQueue();

  const handleRunPresentationTask = () => {
    if (files.length === 0) return;

    if (outputMode === "pdf") {
      enqueue(
        { title: "Convert Slides to PDF", tool: "pptx-convert", kind: "convert", statKind: "convert" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "server",
          run: async (ctx) => {
            const res = await runServerJob("office.convert", [f.file], [f.name], { target: "pdf" }, ctx.signal, (p, s) =>
              ctx.progress(p, s)
            );
            return { outputs: res.files, warnings: res.warnings };
          },
        }))
      );
    } else if (outputMode === "images") {
      enqueue(
        { title: `Extract Slides as ${imageFormat.toUpperCase()}`, tool: "pptx-convert", kind: "convert", statKind: "convert" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "server",
          run: async (ctx) => {
            const res = await runServerJob("office.to_images", [f.file], [f.name], { format: imageFormat, dpi: 150 }, ctx.signal, (p, s) =>
              ctx.progress(p, s)
            );
            return { outputs: res.files, warnings: res.warnings };
          },
        }))
      );
    } else if (outputMode === "video") {
      enqueue(
        { title: "Render Slides to Video", tool: "pptx-convert", kind: "convert", statKind: "convert" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "server",
          run: async (ctx) => {
            const res = await runServerJob(
              "office.to_video",
              [f.file],
              [f.name],
              { secondsPerSlide, width: videoWidth },
              ctx.signal,
              (p, s) => ctx.progress(p, s)
            );
            return { outputs: res.files, warnings: res.warnings };
          },
        }))
      );
    }

    setDrawer(true);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link
          href="/documents"
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Presentation className="w-6 h-6 text-orange-500" />
            Presentation & Slides Studio
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Convert PowerPoint decks (PPTX, PPT, ODP) and PDFs to high-resolution slide images, PDF documents, or slideshow videos.
          </p>
        </div>
      </div>

      <DropZone
        onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
        selectedFiles={files}
        onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
        onClearAll={() => setFiles([])}
        accept=".pptx,.ppt,.odp,.pdf"
        title="Drop PowerPoint presentations or PDF decks here"
        description="Supports PPTX, PPT, ODP, and PDF documents"
        showToolRecommendations={false}
      />

      {files.length > 0 && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block mb-2">
              Select Output Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setOutputMode("pdf")}
                className={clsx(
                  "p-4 rounded-2xl border text-left transition-all",
                  outputMode === "pdf"
                    ? "border-orange-500 bg-orange-50/60 dark:bg-orange-950/40 text-orange-950 dark:text-orange-100 font-bold shadow-xs"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                )}
              >
                <FileType2 className="w-5 h-5 text-orange-600 mb-2" />
                <div className="font-bold text-sm">Slides to PDF</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Vector slide document ready for printing and sharing
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOutputMode("images")}
                className={clsx(
                  "p-4 rounded-2xl border text-left transition-all",
                  outputMode === "images"
                    ? "border-orange-500 bg-orange-50/60 dark:bg-orange-950/40 text-orange-950 dark:text-orange-100 font-bold shadow-xs"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                )}
              >
                <Images className="w-5 h-5 text-orange-600 mb-2" />
                <div className="font-bold text-sm">Extract Slide Images</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  High-res PNG, JPEG, or WebP images packed into a ZIP
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOutputMode("video")}
                className={clsx(
                  "p-4 rounded-2xl border text-left transition-all",
                  outputMode === "video"
                    ? "border-orange-500 bg-orange-50/60 dark:bg-orange-950/40 text-orange-950 dark:text-orange-100 font-bold shadow-xs"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                )}
              >
                <Video className="w-5 h-5 text-orange-600 mb-2" />
                <div className="font-bold text-sm">Slideshow Video (MP4)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Render timed slides into an MP4 video with OpenCV
                </div>
              </button>
            </div>
          </div>

          {/* Options for Slide Images */}
          {outputMode === "images" && (
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Image Format:
              </label>
              <div className="flex gap-2">
                {(["png", "jpeg", "webp"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setImageFormat(fmt)}
                    className={clsx(
                      "px-4 py-2 rounded-xl text-xs font-semibold uppercase border transition-all",
                      imageFormat === fmt
                        ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Options for Video */}
          {outputMode === "video" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Seconds per Slide: {secondsPerSlide}s
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={secondsPerSlide}
                  onChange={(e) => setSecondsPerSlide(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Video Resolution:
                </label>
                <select
                  value={videoWidth}
                  onChange={(e) => setVideoWidth(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  <option value={1920}>Full HD (1920x1080)</option>
                  <option value={1280}>HD (1280x720)</option>
                  <option value={854}>SD (854x480)</option>
                </select>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleRunPresentationTask}
              className="w-full py-3 px-6 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Process {files.length} Presentation(s)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
