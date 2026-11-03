"use client";

import Link from "next/link";
import { TOOLS } from "@/lib/tools";
import {
  FileText,
  Combine,
  Scissors,
  LayoutGrid,
  FileImage,
  FileType2,
  Lock,
  Unlock,
  Wrench,
  Hash,
  Stamp,
  Crop,
  ScanText,
  Search,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Sparkles,
  Presentation,
  FileSpreadsheet,
} from "lucide-react";
import { useState, useMemo } from "react";
import clsx from "clsx";

export default function PdfHubPage() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | "convert" | "manage" | "security">("all");

  const pdfTools = useMemo(() => {
    return TOOLS.filter(
      (t) => t.group === "pdf" || t.group === "pdf-convert" || t.id.startsWith("pdf") || t.id === "images-to-pdf"
    );
  }, []);

  const filtered = useMemo(() => {
    return pdfTools.filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.keywords.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;

      if (filterCategory === "convert") return t.group === "pdf-convert" || t.id === "images-to-pdf";
      if (filterCategory === "security") return ["pdf-protect", "pdf-unlock", "pdf-repair", "pdf-ocr"].includes(t.id);
      if (filterCategory === "manage") return t.group === "pdf" && !["pdf-protect", "pdf-unlock", "pdf-repair", "pdf-ocr"].includes(t.id);
      return true;
    });
  }, [pdfTools, search, filterCategory]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-red-500" />
            Complete PDF Productivity Workspace
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Professional PDF suite: merge, split, compress, AES-256 protect, edit, sign, OCR, and high-fidelity conversion to Word, PowerPoint, and Excel.
          </p>
        </div>

        {/* Search filter */}
        <div className="w-full md:w-64">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 text-xs shadow-2xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search PDF tools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden w-full"
            />
          </div>
        </div>
      </div>

      {/* Filter Category Pills */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: "all", label: "All PDF Tools", count: pdfTools.length },
          { id: "convert", label: "Conversion Suite", count: pdfTools.filter((t) => t.group === "pdf-convert" || t.id === "images-to-pdf").length },
          { id: "manage", label: "Page & Document Tools", count: pdfTools.filter((t) => t.group === "pdf" && !["pdf-protect", "pdf-unlock", "pdf-repair", "pdf-ocr"].includes(t.id)).length },
          { id: "security", label: "Security & OCR", count: 4 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterCategory(tab.id as any)}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer",
              filterCategory === tab.id
                ? "bg-red-500 text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <span>{tab.label}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/10">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tool Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {filtered.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.id}
              href={t.href}
              className="group p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-red-400 dark:hover:border-red-500 hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Icon className="w-4 h-4" />
                  </div>
                  {t.engine === "local" ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                      In-Browser
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded">
                      High-Fidelity
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    {t.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {t.description}
                  </p>
                </div>
              </div>

              <div className="pt-3 mt-2 flex items-center text-[11px] font-semibold text-red-600 dark:text-red-400 group-hover:translate-x-0.5 transition-transform">
                <span>Configure Tool</span>
                <ArrowRight className="w-3 h-3 ml-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
