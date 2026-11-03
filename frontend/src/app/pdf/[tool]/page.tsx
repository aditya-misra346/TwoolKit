"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TOOLS } from "@/lib/tools";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { useQueue } from "@/stores/tasks";
import { runServerJob } from "@/lib/api";
import {
  mergePdfs,
  splitPdf,
  rotatePdf,
  addPageNumbers,
  addWatermark,
  addHeaderFooter,
  cropPdfMargins,
  imagesToPdf,
} from "@/lib/pdfClient";
import { formatBytes } from "@/lib/fileTypes";
import {
  ArrowLeft,
  Sparkles,
  Lock,
  Unlock,
  Play,
  RotateCw,
  Hash,
  Stamp,
  Crop,
  ScanText,
  FileText,
  CheckCircle2,
  AlertCircle,
  Presentation,
  FileSpreadsheet,
  FileType2,
  Images,
  Cpu,
  Layers,
  Settings,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

interface Props {
  params: Promise<{ tool: string }>;
}

export default function DedicatedPdfToolPage({ params }: Props) {
  const { tool: toolSlug } = use(params);
  const router = useRouter();
  const { enqueue, setDrawer } = useQueue();

  // Find tool definition
  const tool = TOOLS.find(
    (t) => t.id === toolSlug || t.id === `pdf-${toolSlug}` || t.href === `/pdf/${toolSlug}`
  );

  const [files, setFiles] = useState<StagedFile[]>([]);
  const [password, setPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.2);
  const [pageNumberPos, setPageNumberPos] = useState<"bottom-center" | "bottom-right" | "top-right">("bottom-center");
  const [pageNumberFmt, setPageNumberFmt] = useState<"number" | "page-of-total" | "page-n">("page-of-total");
  const [splitRange, setSplitRange] = useState("");
  const [pptxMode, setPptxMode] = useState<"hybrid" | "image">("hybrid");
  const [compressLevel, setCompressLevel] = useState<"low" | "balanced" | "max">("balanced");

  const isImagesToPdf = toolSlug === "images-to-pdf";
  const acceptedExt = isImagesToPdf ? ".jpg,.jpeg,.png,.webp,.bmp" : ".pdf";

  const handleRunTool = async () => {
    if (files.length === 0) return;

    if (toolSlug === "merge" || toolSlug === "pdf-merge") {
      enqueue(
        { title: "Merge PDFs", tool: "pdf-merge", kind: "pdf", statKind: "pdf" },
        [
          {
            label: `Merged Document (${files.length} PDFs)`,
            engine: "local",
            run: async (ctx) => {
              const mergedBlob = await mergePdfs(
                files.map((f) => f.file),
                (p, s) => ctx.progress(p, s)
              );
              return {
                outputs: [{ name: "merged-document.pdf", blob: mergedBlob, note: `${files.length} PDFs combined` }],
              };
            },
          },
        ]
      );
      setDrawer(true);
      return;
    }

    if (toolSlug === "split" || toolSlug === "pdf-split") {
      enqueue(
        { title: "Split PDF", tool: "pdf-split", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async () => {
            const splitted = await splitPdf(f.file, splitRange);
            return { outputs: splitted };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    if (toolSlug === "rotate" || toolSlug === "pdf-rotate") {
      enqueue(
        { title: "Rotate PDF", tool: "pdf-rotate", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async () => {
            const rotated = await rotatePdf(f.file, 90);
            return { outputs: [{ name: f.name.replace(".pdf", "-rotated.pdf"), blob: rotated }] };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    if (toolSlug === "page-numbers" || toolSlug === "pdf-page-numbers") {
      enqueue(
        { title: "Add Page Numbers", tool: "pdf-page-numbers", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async () => {
            const numbered = await addPageNumbers(f.file, {
              position: pageNumberPos,
              format: pageNumberFmt,
            });
            return { outputs: [{ name: f.name.replace(".pdf", "-numbered.pdf"), blob: numbered }] };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    if (toolSlug === "watermark" || toolSlug === "pdf-watermark") {
      enqueue(
        { title: "Watermark PDF", tool: "pdf-watermark", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async () => {
            const wm = await addWatermark(f.file, {
              text: watermarkText,
              opacity: watermarkOpacity,
            });
            return { outputs: [{ name: f.name.replace(".pdf", "-watermarked.pdf"), blob: wm }] };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    if (isImagesToPdf) {
      enqueue(
        { title: "Images to PDF", tool: "images-to-pdf", kind: "pdf", statKind: "pdf" },
        [
          {
            label: `Compiled PDF (${files.length} images)`,
            engine: "local",
            run: async (ctx) => {
              const pdfBlob = await imagesToPdf(
                files.map((f) => f.file),
                "fit",
                (p, s) => ctx.progress(p, s)
              );
              return { outputs: [{ name: "compiled-images.pdf", blob: pdfBlob }] };
            },
          },
        ]
      );
      setDrawer(true);
      return;
    }

    // Server-side powered operations
    let serverOp = "pdf.compress";
    let options: Record<string, any> = {};

    if (toolSlug === "to-word" || toolSlug === "pdf-to-word") {
      serverOp = "pdf.to_docx";
      options = { password: password || undefined };
    } else if (toolSlug === "to-pptx" || toolSlug === "pdf-to-pptx") {
      serverOp = "pdf.to_pptx";
      options = { mode: pptxMode, password: password || undefined };
    } else if (toolSlug === "to-excel" || toolSlug === "pdf-to-excel") {
      serverOp = "pdf.to_xlsx";
      options = { password: password || undefined };
    } else if (toolSlug === "compress" || toolSlug === "pdf-compress") {
      serverOp = "pdf.compress";
      options = { level: compressLevel, password: password || undefined };
    } else if (toolSlug === "protect" || toolSlug === "pdf-protect") {
      serverOp = "pdf.protect";
      options = { userPassword: password, ownerPassword: ownerPassword || password };
    } else if (toolSlug === "unlock" || toolSlug === "pdf-unlock") {
      serverOp = "pdf.unlock";
      options = { password };
    } else if (toolSlug === "repair" || toolSlug === "pdf-repair") {
      serverOp = "pdf.repair";
    } else if (toolSlug === "extract-images" || toolSlug === "pdf-extract-images") {
      serverOp = "pdf.extract_images";
      options = { password: password || undefined };
    } else if (toolSlug === "to-svg" || toolSlug === "pdf-to-svg") {
      serverOp = "pdf.to_svg";
      options = { pages: splitRange || undefined, password: password || undefined };
    } else if (toolSlug === "to-html" || toolSlug === "pdf-to-html") {
      serverOp = "pdf.to_html";
    } else if (toolSlug === "to-text" || toolSlug === "pdf-to-text") {
      serverOp = "pdf.to_txt";
    }

    enqueue(
      {
        title: tool?.name || "PDF Operation",
        tool: tool?.id || "pdf",
        kind: "pdf",
        statKind: toolSlug.includes("convert") || toolSlug.includes("to-") ? "convert" : "pdf",
      },
      files.map((f) => ({
        label: f.name,
        inputSize: f.size,
        engine: "server",
        run: async (ctx) => {
          const res = await runServerJob(serverOp, [f.file], [f.name], options, ctx.signal, (p, s) =>
            ctx.progress(p, s)
          );
          return { outputs: res.files, warnings: res.warnings };
        },
      }))
    );
    setDrawer(true);
  };

  const isLocalEngine = tool?.engine === "local" || isImagesToPdf || ["merge", "split", "rotate", "page-numbers", "watermark"].includes(toolSlug);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-150">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-3">
          <Link
            href="/pdf"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>{tool?.name || "PDF Workspace Tool"}</span>
              <span className={clsx(
                "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                isLocalEngine
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              )}>
                {isLocalEngine ? "In-Browser" : "High-Fidelity Engine"}
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {tool?.description || "Configure parameters and run the document operation"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      {files.length === 0 ? (
        <DropZone
          onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
          selectedFiles={files}
          onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
          onClearAll={() => setFiles([])}
          accept={acceptedExt}
          title={isImagesToPdf ? "Drop images to convert into a compiled PDF" : `Drop PDF file(s) for ${tool?.name || "processing"}`}
          description={isImagesToPdf ? "Supports PNG, JPEG, WebP, BMP images" : "Select or drag PDF documents to begin"}
          showToolRecommendations={false}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Uploaded Files & Staging Deck (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <DropZone
              onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
              selectedFiles={files}
              onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
              onClearAll={() => setFiles([])}
              accept={acceptedExt}
              showToolRecommendations={false}
            />
          </div>

          {/* Right Column: Settings & Execution Controls (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Operation Settings
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                {files.length} document(s) staged
              </span>
            </div>

            {/* Options for to-pptx */}
            {(toolSlug === "to-pptx" || toolSlug === "pdf-to-pptx") && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Slide Layout Reconstruction:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPptxMode("hybrid")}
                    className={clsx(
                      "p-3 rounded-xl border text-left text-xs transition-all cursor-pointer",
                      pptxMode === "hybrid"
                        ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <div className="font-bold">Hybrid (Recommended)</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                      Extracts editable text frames while preserving vector art
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPptxMode("image")}
                    className={clsx(
                      "p-3 rounded-xl border text-left text-xs transition-all cursor-pointer",
                      pptxMode === "image"
                        ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <div className="font-bold">Image Slides</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                      Renders rasterized slide pages for exact visual match
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Options for Password Protect */}
            {(toolSlug === "protect" || toolSlug === "pdf-protect") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    User Password (Required to Open):
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter document password"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Owner Password (Optional):
                  </label>
                  <input
                    type="password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="Permissions master password"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* Options for Password Unlock */}
            {(toolSlug === "unlock" || toolSlug === "pdf-unlock") && (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Enter Document Decryption Password:
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password to unlock"
                  className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                />
              </div>
            )}

            {/* Options for Compress */}
            {(toolSlug === "compress" || toolSlug === "pdf-compress") && (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Compression Preset:
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: "low", label: "Low", desc: "Max quality (200 DPI)" },
                    { id: "balanced", label: "Balanced", desc: "Best balance (144 DPI)" },
                    { id: "max", label: "Maximum", desc: "Smallest size (96 DPI)" },
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setCompressLevel(lvl.id as any)}
                      className={clsx(
                        "p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer",
                        compressLevel === lvl.id
                          ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      )}
                    >
                      <div className="font-bold">{lvl.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{lvl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Options for Watermark */}
            {(toolSlug === "watermark" || toolSlug === "pdf-watermark") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Stamp Text:
                  </label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="e.g. CONFIDENTIAL, DRAFT"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Opacity: {Math.round(watermarkOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.8"
                    step="0.05"
                    value={watermarkOpacity}
                    onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                    className="w-full mt-1.5"
                  />
                </div>
              </div>
            )}

            {/* Options for Page Numbers */}
            {(toolSlug === "page-numbers" || toolSlug === "pdf-page-numbers") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Position:
                  </label>
                  <select
                    value={pageNumberPos}
                    onChange={(e) => setPageNumberPos(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  >
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="top-right">Top Right</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Format:
                  </label>
                  <select
                    value={pageNumberFmt}
                    onChange={(e) => setPageNumberFmt(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  >
                    <option value="page-of-total">Page 1 of 10</option>
                    <option value="number">1</option>
                    <option value="page-n">Page 1</option>
                  </select>
                </div>
              </div>
            )}

            {/* Options for Split / Extract */}
            {(toolSlug === "split" || toolSlug === "pdf-split" || toolSlug === "to-svg") && (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Custom Page Range (leave blank for all pages):
                </label>
                <input
                  type="text"
                  value={splitRange}
                  onChange={(e) => setSplitRange(e.target.value)}
                  placeholder="e.g. 1-3, 5, 8-10"
                  className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                />
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">
                {isLocalEngine ? "Client-side browser processing" : "Local server high-fidelity pipeline"}
              </div>
              <button
                onClick={handleRunTool}
                className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Operation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
