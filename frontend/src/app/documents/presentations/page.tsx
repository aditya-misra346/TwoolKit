"use client";

import { useState } from "react";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { useQueue } from "@/stores/tasks";
import { runServerJob } from "@/lib/api";
import { useSettings } from "@/stores/settings";
import { ConsentModal } from "@/components/ConsentModal";
import { extOf } from "@/lib/fileTypes";
import {
  Presentation,
  Video,
  Images,
  FileType2,
  Play,
  ArrowLeft,
  Sparkles,
  Sliders,
  Cpu,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

export default function PresentationStudioPage() {
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [outputMode, setOutputMode] = useState<"pdf" | "images" | "video">("pdf");
  const [imageFormat, setImageFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [slideDpi, setSlideDpi] = useState<number>(200);
  const [slideOrientation, setSlideOrientation] = useState<"preserve" | "16:9" | "4:3">("preserve");
  const [secondsPerSlide, setSecondsPerSlide] = useState(3);
  const [videoWidth, setVideoWidth] = useState(1920);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const { enqueue, setDrawer } = useQueue();
  const { cloudConsent } = useSettings();

  const handleRunPresentationTask = () => {
    if (files.length === 0) return;

    if (!cloudConsent) {
      setShowConsentModal(true);
      return;
    }

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
            const res = await runServerJob("office.to_images", [f.file], [f.name], { format: imageFormat, dpi: slideDpi }, ctx.signal, (p, s) =>
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
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex items-center gap-3 pb-1 border-b border-slate-200/60 dark:border-slate-800/60">
        <Link
          href="/documents"
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Presentation className="w-5 h-5 text-orange-500" />
            Presentation & Slides Studio
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Convert PowerPoint decks (PPTX, PPT, ODP) and PDF slide decks to high-res images, PDF documents, or timed MP4 video.
          </p>
        </div>
      </div>

      {files.length === 0 ? (
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
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Staged files deck */}
          <div className="lg:col-span-5 space-y-3">
            <DropZone
              onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
              selectedFiles={files}
              onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
              onClearAll={() => setFiles([])}
              accept=".pptx,.ppt,.odp,.pdf"
              showToolRecommendations={false}
            />
          </div>

          {/* Settings & Mode panel */}
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs p-5 sm:p-6 space-y-5">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block mb-2">
                Select Presentation Mode
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setOutputMode("pdf")}
                  className={clsx(
                    "p-3 rounded-xl border text-left transition-all cursor-pointer",
                    outputMode === "pdf"
                      ? "border-orange-500 bg-orange-50/60 dark:bg-orange-950/40 text-orange-950 dark:text-orange-100 font-bold shadow-2xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  )}
                >
                  <FileType2 className="w-4 h-4 text-orange-600 mb-1.5" />
                  <div className="font-bold text-xs">Slides to PDF</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Vector slide document ready for distribution
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOutputMode("images")}
                  className={clsx(
                    "p-3 rounded-xl border text-left transition-all cursor-pointer",
                    outputMode === "images"
                      ? "border-orange-500 bg-orange-50/60 dark:bg-orange-950/40 text-orange-950 dark:text-orange-100 font-bold shadow-2xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  )}
                >
                  <Images className="w-4 h-4 text-orange-600 mb-1.5" />
                  <div className="font-bold text-xs">Extract Slide Images</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    PNG, JPEG, or WebP per slide
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOutputMode("video")}
                  className={clsx(
                    "p-3 rounded-xl border text-left transition-all cursor-pointer",
                    outputMode === "video"
                      ? "border-orange-500 bg-orange-50/60 dark:bg-orange-950/40 text-orange-950 dark:text-orange-100 font-bold shadow-2xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  )}
                >
                  <Video className="w-4 h-4 text-orange-600 mb-1.5" />
                  <div className="font-bold text-xs">Slideshow Video</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Rendered MP4 via OpenCV
                  </div>
                </button>
              </div>
            </div>

            {/* Options for PDF & Slide Layout */}
            {outputMode === "pdf" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Slide Aspect & Orientation:
                  </label>
                  <select
                    value={slideOrientation}
                    onChange={(e) => setSlideOrientation(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-hidden"
                  >
                    <option value="preserve">Preserve Original Deck Aspect</option>
                    <option value="16:9">Widescreen Presentation (16:9)</option>
                    <option value="4:3">Standard Slide Deck (4:3)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Vector & Embedded Graphics DPI:
                  </label>
                  <select
                    value={slideDpi}
                    onChange={(e) => setSlideDpi(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-hidden"
                  >
                    <option value={150}>150 DPI (Web & Email)</option>
                    <option value={200}>200 DPI (High Clarity - Recommended)</option>
                    <option value={300}>300 DPI (Print & Archival)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Options for Slide Images */}
            {outputMode === "images" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
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
                          "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase border transition-all cursor-pointer",
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
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Slide Render DPI:
                  </label>
                  <select
                    value={slideDpi}
                    onChange={(e) => setSlideDpi(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-hidden"
                  >
                    <option value={150}>150 DPI (Standard HD)</option>
                    <option value={200}>200 DPI (Crisp Retina)</option>
                    <option value={300}>300 DPI (Ultra Print)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Options for Video */}
            {outputMode === "video" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Duration per Slide: {secondsPerSlide}s
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={secondsPerSlide}
                    onChange={(e) => setSecondsPerSlide(parseFloat(e.target.value))}
                    className="w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Output Resolution:
                  </label>
                  <select
                    value={videoWidth}
                    onChange={(e) => setVideoWidth(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-hidden"
                  >
                    <option value={1920}>Full HD (1920x1080)</option>
                    <option value={1280}>HD (1280x720)</option>
                    <option value={854}>SD (854x480)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-orange-500" />
                <span>Local Server Headless Rendering</span>
              </div>
              <button
                onClick={handleRunPresentationTask}
                className="py-2.5 px-6 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Process {files.length} Deck(s)</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Consent Modal for Server Processing */}
      <ConsentModal
        isOpen={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        onConfirm={() => {
          setShowConsentModal(false);
          handleRunPresentationTask();
        }}
      />
    </div>
  );
}
