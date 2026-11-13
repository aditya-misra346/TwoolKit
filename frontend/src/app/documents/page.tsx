"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { useQueue } from "@/stores/tasks";
import { runServerJob, hasBackendServer } from "@/lib/api";
import { canConvertClientSide, convertDocumentClient } from "@/lib/documentClient";
import { useSettings } from "@/stores/settings";
import { ConsentModal } from "@/components/ConsentModal";
import { extOf } from "@/lib/fileTypes";
import {
  FileType2,
  FileSpreadsheet,
  Presentation,
  ArrowRight,
  Play,
  Sparkles,
  Layers,
  CheckCircle2,
  FileText,
  Cpu,
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

const FORMAT_MATRIX: Record<string, string[]> = {
  // Word & text
  docx: ["pdf", "odt", "rtf", "txt", "md", "html", "doc"],
  doc: ["pdf", "docx", "odt", "txt", "html"],
  odt: ["pdf", "docx", "rtf", "txt", "md", "html"],
  rtf: ["pdf", "docx", "odt", "txt", "md", "html"],
  txt: ["pdf", "docx", "html", "md", "rtf"],
  md: ["html", "pdf", "docx", "txt"],
  html: ["md", "txt", "pdf", "docx"],

  // Spreadsheets
  xlsx: ["csv", "tsv", "json", "xml", "md", "html", "pdf", "ods"],
  xls: ["xlsx", "csv", "pdf", "ods", "html"],
  ods: ["xlsx", "csv", "pdf", "html"],
  csv: ["xlsx", "tsv", "json", "xml", "html", "md", "pdf", "ods"],
  tsv: ["csv", "xlsx", "json", "xml", "html", "md", "pdf"],

  // Presentations
  pptx: ["pdf", "odp", "ppt", "txt", "html"],
  ppt: ["pdf", "pptx", "odp"],
  odp: ["pdf", "pptx", "txt", "html"],

  // Data
  json: ["csv", "tsv", "xlsx", "xml", "md", "html"],
  xml: ["json", "csv", "tsv", "xlsx"],
};

const DATA_NATIVE_MATRIX: Record<string, string[]> = {
  csv: ["tsv", "json", "xlsx", "html", "md", "xml"],
  tsv: ["csv", "json", "xlsx", "html", "md", "xml"],
  json: ["csv", "tsv", "xlsx", "xml"],
  xml: ["json"],
  xlsx: ["csv", "tsv", "json"],
  md: ["html", "pdf", "docx", "txt"],
  html: ["md", "txt", "pdf", "docx"],
  txt: ["pdf", "docx", "html", "md"],
};

function DocumentConverterContent() {
  const searchParams = useSearchParams();
  const family = searchParams.get("family");
  const initialTarget = searchParams.get("target") || (family === "spreadsheet" ? "xlsx" : "pdf");
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [targetFormat, setTargetFormat] = useState<string>(initialTarget);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const { enqueue, setDrawer } = useQueue();
  const { cloudConsent } = useSettings();

  const primaryExt = files.length > 0 ? extOf(files[0].name) : "docx";
  const availableTargets = FORMAT_MATRIX[primaryExt] || ["pdf"];

  // Ensure targetFormat is always a valid target when source file type changes
  useEffect(() => {
    if (files.length > 0 && !availableTargets.includes(targetFormat)) {
      setTargetFormat(availableTargets[0]);
    }
  }, [files.length, primaryExt, availableTargets, targetFormat]);

  const handleRunConversion = () => {
    if (files.length === 0) return;

    const allHaveClientFallback = files.every((f) =>
      canConvertClientSide(extOf(f.name), targetFormat)
    );

    if (!allHaveClientFallback && !useSettings.getState().cloudConsent) {
      setShowConsentModal(true);
      return;
    }

    enqueue(
      {
        title: `Convert to ${targetFormat.toUpperCase()}`,
        tool: "doc-convert",
        kind: "convert",
        statKind: "convert",
      },
      files.map((f) => ({
        label: f.name,
        inputSize: f.size,
        engine: canConvertClientSide(extOf(f.name), targetFormat) ? "local" : "server",
        run: async (ctx) => {
          const ext = extOf(f.name);
          const isDataNative = Boolean(DATA_NATIVE_MATRIX[ext]?.includes(targetFormat));
          const op = isDataNative ? "data.convert" : "office.convert";

          if (useSettings.getState().cloudConsent && (await hasBackendServer(op))) {
            try {
              const res = await runServerJob(
                op,
                [f.file],
                [f.name],
                { target: targetFormat },
                ctx.signal,
                (p, s) => ctx.progress(p, s)
              );
              return { outputs: res.files, warnings: res.warnings };
            } catch (err: any) {
              const isServerIssue =
                err?.status === 404 ||
                err?.status === 428 ||
                err?.status === 502 ||
                err?.status === 503 ||
                err?.status === 0 ||
                /not reach|disappeared|HTTP 404|404|503|502|428|NetworkError|active backend service/i.test(
                  err?.message || ""
                );
              if (!isServerIssue || !canConvertClientSide(ext, targetFormat)) {
                throw err;
              }
            }
          }

          if (canConvertClientSide(ext, targetFormat)) {
            ctx.progress(0.25, "Converting with in-browser document engine");
            const out = await convertDocumentClient(f.file, targetFormat, (p, s) =>
              ctx.progress(p, s)
            );
            return {
              outputs: [{ name: out.name, blob: out.blob }],
              warnings: ["Converted locally using in-browser document engine"],
            };
          }

          const res = await runServerJob(op, [f.file], [f.name], { target: targetFormat }, ctx.signal, (p, s) =>
            ctx.progress(p, s)
          );
          return { outputs: res.files, warnings: res.warnings };
        },
      }))
    );
    setDrawer(true);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <FileType2 className="w-7 h-7 text-blue-400 shrink-0" />
            <span>Universal Document & Tabular Converter</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mt-1.5 max-w-3xl leading-relaxed">
            High-fidelity document conversion powered by headless LibreOffice and native tabular stream parsers.
          </p>
        </div>

        <Link
          href="/documents/presentations"
          className="px-4 py-2.5 rounded-xl bg-orange-950/50 text-orange-300 border border-orange-800/80 text-xs sm:text-sm font-semibold flex items-center gap-2 shrink-0 self-start hover:bg-orange-900/40 transition-colors"
        >
          <Presentation className="w-4 h-4 text-orange-400" />
          <span>Presentation Studio</span>
        </Link>
      </div>

      {files.length === 0 ? (
        <DropZone
          onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
          selectedFiles={files}
          onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
          onClearAll={() => setFiles([])}
          title="Drop Word documents, spreadsheets, presentations, or data files"
          description="Supports DOCX, PPTX, XLSX, ODT, RTF, CSV, TSV, JSON, XML, HTML, and Markdown"
          showToolRecommendations={false}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Staged files */}
          <div className="lg:col-span-5 space-y-3">
            <DropZone
              onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
              selectedFiles={files}
              onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
              onClearAll={() => setFiles([])}
              showToolRecommendations={false}
            />
          </div>

          {/* Target format matrix */}
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs p-5 sm:p-6 space-y-5">
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                  Select Target Format
                </span>
                <span className="text-[11px] text-slate-400">
                  Target conversion options for {primaryExt.toUpperCase()}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 uppercase">
                From .{primaryExt}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {availableTargets.map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => setTargetFormat(target)}
                  className={clsx(
                    "p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer",
                    targetFormat === target
                      ? "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100 font-bold shadow-2xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  )}
                >
                  <span className="text-sm uppercase font-mono">{target}</span>
                  <span className="text-[10px] text-slate-400 capitalize">
                    {target === "pdf" ? "Portable Doc" : `${target.toUpperCase()} Format`}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Cpu className="w-3.5 h-3.5 text-blue-500" />
                <span>LibreOffice Headless & Stream Pipeline</span>
              </div>
              <button
                onClick={handleRunConversion}
                className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Convert to {targetFormat.toUpperCase()}</span>
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
          handleRunConversion();
        }}
      />
    </div>
  );
}

export default function DocumentConverterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading Document Converter...</div>}>
      <DocumentConverterContent />
    </Suspense>
  );
}
