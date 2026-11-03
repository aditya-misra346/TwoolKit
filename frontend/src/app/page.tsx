"use client";

import { useScanStore } from "@/stores/scanStore";
import { useHistory } from "@/stores/history";
import { StorageChart } from "@/components/StorageChart";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { TOOLS } from "@/lib/tools";
import {
  formatBytes,
  formatRelative,
  bucketOf,
  type StorageBucket,
} from "@/lib/fileTypes";
import {
  ScanSearch,
  HardDrive,
  Copy,
  Layers,
  ArrowRight,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Presentation,
  FileType2,
  Image as ImageIcon,
  Minimize2,
  FolderTree,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import clsx from "clsx";

export default function DashboardPage() {
  const router = useRouter();
  const { currentScan } = useScanStore();
  const { stats, activities } = useHistory();
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);

  // Real storage breakdown
  const storageBreakdown = useMemo(() => {
    const buckets: Record<StorageBucket, number> = {
      documents: 0,
      images: 0,
      presentations: 0,
      videos: 0,
      audio: 0,
      archives: 0,
      other: 0,
    };
    if (currentScan) {
      for (const [cat, bytes] of Object.entries(currentScan.categoryBytes)) {
        const b = bucketOf(cat as any);
        buckets[b] = (buckets[b] || 0) + bytes;
      }
    }
    return buckets;
  }, [currentScan]);

  const wastedDuplicateBytes = useMemo(() => {
    if (!currentScan) return 0;
    return currentScan.duplicateGroups.reduce((acc, g) => acc + g.totalWastedBytes, 0);
  }, [currentScan]);

  const handleFilesSelected = (staged: StagedFile[]) => {
    setStagedFiles(staged);
  };

  // 8 specific quick tools requested by the user
  const quickToolConfigs = [
    {
      id: "pdf-to-pptx",
      name: "PDF to PPTX",
      desc: "Convert PDF pages into presentation slides with layout reconstruction.",
      href: "/pdf/to-pptx",
      icon: Presentation,
      engine: "Server",
      color: "text-orange-500 bg-orange-50 dark:bg-orange-950/60",
    },
    {
      id: "pptx-to-pdf",
      name: "PPTX to PDF",
      desc: "Convert PowerPoint slide decks directly into vector PDFs.",
      href: "/documents/presentations",
      icon: FileType2,
      engine: "Server",
      color: "text-blue-500 bg-blue-50 dark:bg-blue-950/60",
    },
    {
      id: "image-studio",
      name: "Image Converter",
      desc: "Convert, resize, crop, rotate and strip EXIF for WebP, AVIF, PNG, JPG.",
      href: "/images",
      icon: ImageIcon,
      engine: "Browser",
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60",
    },
    {
      id: "pdf-compressor",
      name: "PDF Compressor",
      desc: "Reduce PDF file size via PyMuPDF image downsampling and stream cleanup.",
      href: "/pdf/compress",
      icon: Minimize2,
      engine: "Server",
      color: "text-purple-500 bg-purple-50 dark:bg-purple-950/60",
    },
    {
      id: "image-compressor",
      name: "Image Compressor",
      desc: "Lossless and balanced client-side image compression with live preview.",
      href: "/images?tool=compress",
      icon: TrendingDown,
      engine: "Browser",
      color: "text-teal-500 bg-teal-50 dark:bg-teal-950/60",
    },
    {
      id: "file-scanner",
      name: "File Scanner",
      desc: "Scan files and folders for signatures, MIME mismatches and security checks.",
      href: "/scanner",
      icon: ScanSearch,
      engine: "Browser",
      color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60",
    },
    {
      id: "duplicate-finder",
      name: "Duplicate Finder",
      desc: "Detect exact SHA-256 duplicate copies and visually similar photos.",
      href: "/scanner?tab=duplicates",
      icon: Copy,
      engine: "Browser",
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/60",
    },
    {
      id: "storage-analyzer",
      name: "Storage Analyzer",
      desc: "Analyze disk distribution, oversized files, and recoverable trash.",
      href: "/storage",
      icon: HardDrive,
      engine: "Browser",
      color: "text-sky-500 bg-sky-50 dark:bg-sky-950/60",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* 1. Welcome Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Workspace Online · Dual Processing Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Universal File Management & Processing
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Enterprise document conversion, deep cryptographic scanning, storage analytics, and multi-format compression.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/scanner"
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <ScanSearch className="w-3.5 h-3.5" />
            <span>Scan Folder</span>
          </Link>
          <Link
            href="/storage"
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            Manage Storage
          </Link>
        </div>
      </div>

      {/* 2. Asymmetrical Storage & Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Storage Distribution Card (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Storage Analytics
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Distribution across analyzed documents, images, and archives
                  </p>
                </div>
              </div>
              {currentScan && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {currentScan.files.length} Files Scanned
                </span>
              )}
            </div>

            <div className="py-5">
              <StorageChart
                bucketBytes={storageBreakdown}
                totalBytes={currentScan?.totalBytes ?? 0}
              />
            </div>
          </div>

          {/* Bottom Alert / Callout */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span>Wasted in duplicate copies:</span>
              <strong className="text-slate-900 dark:text-white font-mono font-semibold">
                {formatBytes(wastedDuplicateBytes)}
              </strong>
            </div>
            <Link
              href="/storage"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Smart cleanup</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Right Column: 4 Real Metrics Tiles (5 cols) */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
          {/* Tile 1: Files Analyzed */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Analyzed Files
              </span>
              <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-500 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {currentScan ? currentScan.files.length.toLocaleString() : "0"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                across {currentScan ? currentScan.folders.length : 0} folder(s)
              </div>
            </div>
          </div>

          {/* Tile 2: Duplicate Copies */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Duplicates
              </span>
              <div className="w-6 h-6 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-500 flex items-center justify-center">
                <Copy className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {currentScan ? currentScan.duplicateGroups.length : 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                {currentScan && wastedDuplicateBytes > 0
                  ? `${formatBytes(wastedDuplicateBytes)} reclaimable`
                  : "No redundant copies"}
              </div>
            </div>
          </div>

          {/* Tile 3: Conversions Completed */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Conversions
              </span>
              <div className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {stats.filesConverted.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                {stats.tasksCompleted} tasks completed
              </div>
            </div>
          </div>

          {/* Tile 4: Space Saved */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Storage Saved
              </span>
              <div className="w-6 h-6 rounded-md bg-purple-50 dark:bg-purple-950 text-purple-500 flex items-center justify-center">
                <TrendingDown className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {formatBytes(stats.bytesSavedByCompression)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                by {stats.filesCompressed} compressed files
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Universal File Intake & Workbench */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Universal Workspace Intake
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Drag and drop any files or folders to stage and route into conversions, scans, or compression
            </p>
          </div>
        </div>

        <DropZone
          onFilesSelected={handleFilesSelected}
          selectedFiles={stagedFiles}
          onRemoveFile={(id) => setStagedFiles((prev) => prev.filter((f) => f.id !== id))}
          onClearAll={() => setStagedFiles([])}
          title="Drop any documents, images, presentations, or folders here"
          description="TWOOLKIT detects mime signatures and recommends optimal high-fidelity workflows"
        />
      </div>

      {/* 4. Quick Tools Section (8 Distinctive Shortcuts) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Essential Tools & Utilities
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Direct access to our most requested conversion and scanning engines
            </p>
          </div>
          <Link
            href="/pdf"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>Explore all {TOOLS.length} tools</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {quickToolConfigs.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.id}
                href={tool.href}
                className="group p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div
                      className={clsx(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105",
                        tool.color
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {tool.engine}
                    </span>
                  </div>
                  <div className="mt-3">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {tool.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {tool.desc}
                    </p>
                  </div>
                </div>
                <div className="pt-3 mt-2 flex items-center text-[11px] font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Open Tool</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 5. Recent Activity Feed */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Recent Processing Timeline
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Live audit trail of conversions, scans, and compressions executed in this session
            </p>
          </div>
          <Link
            href="/recent"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all history
          </Link>
        </div>

        <div className="mt-3">
          {activities.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
              No processing activity logged yet. Drop a file above to begin.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {activities.slice(0, 5).map((act) => (
                <div key={act.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {act.status === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : act.status === "failed" ? (
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {act.title}
                      </div>
                      {act.detail && (
                        <div className="text-[11px] text-slate-400 truncate">
                          {act.detail}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className="text-[11px] text-slate-400">{formatRelative(act.ts)}</span>
                    {act.bytesIn && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        {formatBytes(act.bytesIn)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
