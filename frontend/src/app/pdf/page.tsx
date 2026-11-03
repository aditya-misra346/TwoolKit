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
} from "lucide-react";
import { useState } from "react";

export default function PdfHubPage() {
  const [search, setSearch] = useState("");

  const pdfTools = TOOLS.filter(
    (t) => t.group === "pdf" || t.group === "pdf-convert" || t.id.startsWith("pdf")
  );

  const filtered = pdfTools.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.keywords.toLowerCase().includes(search.toLowerCase())
  );

  const convertTools = filtered.filter((t) => t.group === "pdf-convert");
  const editTools = filtered.filter((t) => t.group === "pdf");

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-red-500" />
            Complete PDF Toolkit
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Professional PDF suite: merge, split, compress, protect, edit, sign, OCR, and convert between Word, PowerPoint, Excel, and images.
          </p>
        </div>

        {/* Search filter */}
        <div className="w-full md:w-64">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-2xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter PDF tools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden w-full"
            />
          </div>
        </div>
      </div>

      {/* Conversion Section */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
          PDF Conversion Suite
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {convertTools.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.id}
                href={t.href}
                className="group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-red-400 dark:hover:border-red-500 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    {t.engine === "local" ? (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-sm">
                        In-Browser
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-sm">
                        High-Fidelity
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-4 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    {t.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {t.description}
                  </p>
                </div>
                <div className="pt-4 flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 group-hover:translate-x-1 transition-transform">
                  <span>Open Tool</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Management & Editing Section */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
          PDF Editing, Security & Organization
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {editTools.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.id}
                href={t.href}
                className="group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t.engine === "local" ? "100% Client-Side" : "Server Engine"}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {t.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {t.description}
                  </p>
                </div>
                <div className="pt-4 flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                  <span>Open Tool</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
