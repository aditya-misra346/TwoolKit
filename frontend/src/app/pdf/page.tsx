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
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <FileText className="w-7 h-7 text-red-500 shrink-0" />
            <span>Complete PDF Productivity Workspace</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mt-1.5 max-w-3xl leading-relaxed">
            Professional PDF suite: merge, split, compress, AES-256 protect, edit, sign, OCR, and high-fidelity conversion to Word, PowerPoint, and Excel.
          </p>
        </div>

        {/* Search filter */}
        <div className="w-full md:w-72">
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm shadow-2xs">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search PDF tools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-white placeholder:text-slate-400 focus:outline-hidden w-full"
            />
          </div>
        </div>
      </div>

      {/* Filter Category Pills */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
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
              "px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer",
              filterCategory === tab.id
                ? "bg-red-500 text-white shadow-2xs"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
          >
            <span>{tab.label}</span>
            <span className="px-2 py-0.5 rounded-full text-2xs bg-black/20">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tool Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.id}
              href={t.href}
              className="group p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-red-500 hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-red-950/60 text-red-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>
                  {t.engine === "local" ? (
                    <span className="text-2xs font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/50 border border-emerald-800/60 px-2.5 py-0.5 rounded-md">
                      In-Browser
                    </span>
                  ) : (
                    <span className="text-2xs font-bold uppercase tracking-wider text-blue-300 bg-blue-950/50 border border-blue-800/60 px-2.5 py-0.5 rounded-md">
                      High-Fidelity
                    </span>
                  )}
                </div>

                <div className="mt-3.5">
                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-red-400 transition-colors">
                    {t.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                    {t.description}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-2 flex items-center text-xs font-semibold text-red-400 group-hover:translate-x-0.5 transition-transform">
                <span>Configure Tool</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
