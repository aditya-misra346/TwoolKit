"use client";

import { useState } from "react";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { useQueue } from "@/stores/tasks";
import { runServerJob } from "@/lib/api";
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
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

const FORMAT_MATRIX: Record<string, string[]> = {
  // Word & text
  docx: ["pdf", "odt", "rtf", "txt", "html", "doc"],
  doc: ["pdf", "docx", "odt", "txt"],
  odt: ["pdf", "docx", "rtf", "txt"],
  rtf: ["pdf", "docx", "odt", "txt"],
  txt: ["pdf", "docx", "html", "md"],
  md: ["html", "pdf", "docx", "txt"],
  html: ["md", "txt", "pdf", "docx"],

  // Spreadsheets
  xlsx: ["csv", "tsv", "json", "pdf", "ods"],
  xls: ["xlsx", "csv", "pdf"],
  ods: ["xlsx", "csv", "pdf"],
  csv: ["xlsx", "tsv", "json", "html", "md", "xml"],
  tsv: ["csv", "xlsx", "json", "html"],

  // Presentations
  pptx: ["pdf", "odp", "ppt"],
  ppt: ["pdf", "pptx", "odp"],
  odp: ["pdf", "pptx"],

  // Data
  json: ["csv", "tsv", "xlsx", "xml"],
  xml: ["json"],
};

export default function DocumentConverterPage() {
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [targetFormat, setTargetFormat] = useState<string>("pdf");
  const { enqueue, setDrawer } = useQueue();

  const primaryExt = files.length > 0 ? extOf(files[0].name) : "docx";
  const availableTargets = FORMAT_MATRIX[primaryExt] || ["pdf"];

  const handleRunConversion = () => {
    if (files.length === 0) return;

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
        engine: "server",
        run: async (ctx) => {
          const ext = extOf(f.name);
          const isDataNative = ["csv", "tsv", "json", "xml", "md"].includes(ext) &&
            ["tsv", "json", "xml", "csv", "xlsx", "md", "html"].includes(targetFormat);

          const op = isDataNative ? "data.convert" : "office.convert";
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
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <FileType2 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Universal Document Converter
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            High-fidelity document conversion powered by headless LibreOffice and native tabular parsers.
          </p>
        </div>

        <Link
          href="/documents/presentations"
          className="px-4 py-2 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 text-xs font-semibold flex items-center gap-2 shrink-0 self-start"
        >
          <Presentation className="w-4 h-4 text-orange-600" />
          PowerPoint & Slides Studio
        </Link>
      </div>

      <DropZone
        onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
        selectedFiles={files}
        onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
        onClearAll={() => setFiles([])}
        title="Drop Word documents, spreadsheets, presentations, or data files"
        description="Supports DOCX, PPTX, XLSX, ODT, RTF, CSV, TSV, JSON, XML, HTML, Markdown"
        showToolRecommendations={false}
      />

      {files.length > 0 && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block mb-2">
              Select Target Format for {primaryExt.toUpperCase()}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {availableTargets.map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => setTargetFormat(target)}
                  className={clsx(
                    "p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1",
                    targetFormat === target
                      ? "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100 font-bold shadow-xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                  )}
                >
                  <span className="text-sm uppercase font-mono">{target}</span>
                  <span className="text-[10px] text-slate-400 capitalize">
                    {target === "pdf" ? "Portable Document" : `${target.toUpperCase()} File`}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleRunConversion}
              className="w-full py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Convert {files.length} Document(s) to {targetFormat.toUpperCase()}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
