"use client";

import { useScanStore } from "@/stores/scanStore";
import { useHistory } from "@/stores/history";
import { useSettings } from "@/stores/settings";
import { useQueue } from "@/stores/tasks";
import { StorageChart } from "@/components/StorageChart";
import {
  LargestFilesBarChart,
  FormatDistributionChart,
  ActivityTrendChart,
  ProcessingStatusChart,
} from "@/components/AnalyticsCharts";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { Logo } from "@/components/Logo";
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
  FileText,
  Image as ImageIcon,
  Minimize2,
  FolderTree,
  Star,
  BarChart3,
  PieChart,
  Activity,
  Cpu,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect, Suspense } from "react";
import clsx from "clsx";

function DashboardContent() {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");

  const { currentScan } = useScanStore();
  const { stats, activities } = useHistory();
  const { favorites, toggleFavorite } = useSettings();
  const { order, tasks } = useQueue();

  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [toolTab, setToolTab] = useState<"featured" | "recent" | "favorites">("featured");

  useEffect(() => {
    if (viewParam === "favorites") {
      setToolTab("favorites");
    }
  }, [viewParam]);

  const activeTaskCount = useMemo(
    () =>
      order.filter(
        (id) => tasks[id]?.status === "running" || tasks[id]?.status === "queued"
      ).length,
    [order, tasks]
  );

  // Real storage breakdown (bytes & file counts across 8 categories)
  const { storageBreakdown, storageCounts } = useMemo(() => {
    const buckets: Record<StorageBucket, number> = {
      documents: 0,
      pdfs: 0,
      images: 0,
      presentations: 0,
      videos: 0,
      audio: 0,
      archives: 0,
      other: 0,
    };
    const counts: Record<StorageBucket, number> = {
      documents: 0,
      pdfs: 0,
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
      for (const [cat, cnt] of Object.entries(currentScan.categoryCounts)) {
        const b = bucketOf(cat as any);
        counts[b] = (counts[b] || 0) + cnt;
      }
    }
    return { storageBreakdown: buckets, storageCounts: counts };
  }, [currentScan]);

  const wastedDuplicateBytes = useMemo(() => {
    if (!currentScan) return 0;
    return currentScan.duplicateGroups.reduce((acc, g) => acc + g.totalWastedBytes, 0);
  }, [currentScan]);

  const largeFilesBytes = useMemo(() => {
    if (!currentScan) return 0;
    return currentScan.largeFiles.reduce((acc, f) => acc + f.size, 0);
  }, [currentScan]);

  // 9 Distinctive Featured Shortcuts requested in Section 2.A
  const featuredShortcuts = [
    {
      id: "pdf-workspace",
      toolId: "pdf-merge",
      name: "PDF Tools",
      desc: "Merge, split, organize, rotate, AES-256 protect, sign, and OCR PDFs.",
      href: "/pdf",
      icon: FileText,
      engine: "Hybrid",
      color: "text-red-500 bg-red-50 dark:bg-red-950/60",
    },
    {
      id: "pdf-to-word",
      toolId: "pdf-to-word",
      name: "PDF to Word",
      desc: "Editable DOCX conversion with layout, table, and typography reconstruction.",
      href: "/pdf/to-word",
      icon: FileType2,
      engine: "Hybrid",
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/60",
    },
    {
      id: "pptx-to-pdf",
      toolId: "pptx-convert",
      name: "PPTX to PDF",
      desc: "Convert PowerPoint slide decks into vector PDFs, slide images, or MP4.",
      href: "/documents/presentations",
      icon: Presentation,
      engine: "Server",
      color: "text-orange-500 bg-orange-50 dark:bg-orange-950/60",
    },
    {
      id: "image-converter",
      toolId: "image-convert",
      name: "Image Converter",
      desc: "Convert between WebP, AVIF, PNG, JPEG, HEIC, TIFF, SVG, and ICO.",
      href: "/images",
      icon: ImageIcon,
      engine: "Browser",
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60",
    },
    {
      id: "image-compressor",
      toolId: "image-compress",
      name: "Image Compressor",
      desc: "Precision lossy & lossless image optimization with live split comparison.",
      href: "/images?tool=compress",
      icon: TrendingDown,
      engine: "Browser",
      color: "text-teal-500 bg-teal-50 dark:bg-teal-950/60",
    },
    {
      id: "file-scanner",
      toolId: "scanner",
      name: "File Scanner",
      desc: "Deep magic-byte signature verification, SHA-256 hashing & anomaly scan.",
      href: "/scanner",
      icon: ScanSearch,
      engine: "Browser",
      color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60",
    },
    {
      id: "storage-manager",
      toolId: "storage",
      name: "Storage Manager",
      desc: "Analyze disk consumption by folder, smart waste cleanup, and Recycle Bin.",
      href: "/storage",
      icon: HardDrive,
      engine: "Browser",
      color: "text-sky-500 bg-sky-50 dark:bg-sky-950/60",
    },
    {
      id: "duplicate-finder",
      toolId: "duplicates",
      name: "Duplicate Finder",
      desc: "Locate exact byte-for-byte SHA-256 duplicates and visually similar photos.",
      href: "/scanner?tab=duplicates",
      icon: Copy,
      engine: "Browser",
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/60",
    },
    {
      id: "file-organizer",
      toolId: "organizer",
      name: "File Organizer",
      desc: "Batch rename with patterns, auto-sort into folders, and safe ZIP tools.",
      href: "/organizer",
      icon: FolderTree,
      engine: "Browser",
      color: "text-purple-500 bg-purple-50 dark:bg-purple-950/60",
    },
  ];

  // Derive Frequently / Recently Used Tools from real activity log
  const recentToolsList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const act of activities) {
      if (act.tool) {
        counts.set(act.tool, (counts.get(act.tool) || 0) + 1);
      }
    }
    const matched = TOOLS.filter((t) => counts.has(t.id)).sort(
      (a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0)
    );
    return matched.slice(0, 9);
  }, [activities]);

  const favoriteToolsList = useMemo(() => {
    return TOOLS.filter((t) => favorites.includes(t.id));
  }, [favorites]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. Welcome Banner & Executive Actions */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-2xs bg-subtle-grid">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <Logo variant="icon" size="lg" className="hidden sm:inline-flex mt-0.5 shrink-0" />
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-800/60 text-xs font-semibold text-blue-300 mb-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>TWOOLKIT Workspace · Dual Local & Server Engine</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-white tracking-tight leading-tight">
                Universal File Intelligence & Conversion Studio
              </h1>
              <p className="text-sm sm:text-base text-slate-300 mt-1.5 max-w-3xl leading-relaxed">
                High-precision PDF engineering, document & slide conversion, image optimization, cryptographic file scanning, and interactive storage telemetry.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/scanner"
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <ScanSearch className="w-4 h-4" />
              <span>Scan Folder</span>
            </Link>
            <Link
              href="/pdf/to-word"
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              <FileType2 className="w-4 h-4 text-blue-400" />
              <span>PDF to Word</span>
            </Link>
            <Link
              href="/storage"
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              Storage Manager
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Universal File Intake & Instant Tool Routing */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Universal File Intake & Smart Router
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Drop any PDF, Office document, presentation, image, or folder to inspect signatures and launch matching tools
            </p>
          </div>
        </div>

        <DropZone
          onFilesSelected={(staged) => setStagedFiles(staged)}
          selectedFiles={stagedFiles}
          onRemoveFile={(id) => setStagedFiles((prev) => prev.filter((f) => f.id !== id))}
          onClearAll={() => setStagedFiles([])}
          title="Drag & drop files or entire folders anywhere here"
          description="Automatic MIME signature detection routes your files to PDF, Word, PowerPoint, Image, or Scanner workflows"
        />
      </div>

      {/* 3. Interactive Storage Analytics & Key Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Multi-View Interactive Storage Analytics (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Interactive Storage Distribution
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Switch between Donut, Pie, and Bar views across all 8 file categories
                  </p>
                </div>
              </div>
              {currentScan && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 metric-number">
                  {currentScan.files.length} Files Indexed
                </span>
              )}
            </div>

            <div className="py-4">
              <StorageChart
                bucketBytes={storageBreakdown}
                bucketCounts={storageCounts}
                totalBytes={currentScan?.totalBytes ?? 0}
                defaultView="donut"
                showViewSwitcher={true}
              />
            </div>
          </div>

          {/* Storage Cleanup Summary Ribbon */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
              <span className="text-[10px] text-slate-400 block">Duplicate Waste</span>
              <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold metric-number">
                {formatBytes(wastedDuplicateBytes)}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
              <span className="text-[10px] text-slate-400 block">Large Files (&gt;5MB)</span>
              <strong className="text-blue-600 dark:text-blue-400 font-mono font-bold metric-number">
                {formatBytes(largeFilesBytes)}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block">Recoverable</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold metric-number">
                  {formatBytes(wastedDuplicateBytes)}
                </strong>
              </div>
              <Link
                href="/storage"
                className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                title="Open Smart Cleanup"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: 4 Executive Telemetry Cards + Processing Status (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3.5">
            {/* Tile 1: Files Analyzed */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Analyzed Files
                </span>
                <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-500 flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight metric-number">
                  {currentScan ? currentScan.files.length.toLocaleString() : "0"}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  across {currentScan ? currentScan.folders.length : 0} folder(s)
                </div>
              </div>
            </div>

            {/* Tile 2: Duplicate Clusters */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Duplicates
                </span>
                <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-500 flex items-center justify-center">
                  <Copy className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight metric-number">
                  {currentScan ? currentScan.duplicateGroups.length : 0}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {currentScan && wastedDuplicateBytes > 0
                    ? `${formatBytes(wastedDuplicateBytes)} reclaimable`
                    : "Zero redundant copies"}
                </div>
              </div>
            </div>

            {/* Tile 3: Conversions Completed */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Conversions
                </span>
                <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight metric-number">
                  {stats.filesConverted.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {stats.tasksCompleted} jobs succeeded
                </div>
              </div>
            </div>

            {/* Tile 4: Compression Savings */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Storage Saved
                </span>
                <div className="w-6 h-6 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-500 flex items-center justify-center">
                  <TrendingDown className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight metric-number">
                  {formatBytes(stats.bytesSavedByCompression)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  from {stats.filesCompressed} compressed files
                </div>
              </div>
            </div>
          </div>

          {/* Processing Analytics Breakdown Card */}
          <div className="flex-1 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Processing Engine Telemetry
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {activeTaskCount > 0 ? `${activeTaskCount} active` : "Idle"}
              </span>
            </div>
            <ProcessingStatusChart stats={stats} activeTasks={activeTaskCount} />
          </div>
        </div>
      </div>

      {/* 4. Deep Data Visualizations Grid (Largest Files, Format Distribution, Activity Timeline) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Largest Files Horizontal Bar Chart (4 cols) */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Largest Scanned Files
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Top storage consumers ranked by size
                  </p>
                </div>
              </div>
              <Link
                href="/scanner?tab=large"
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Inspect all
              </Link>
            </div>
            <LargestFilesBarChart
              files={currentScan?.files || []}
              totalBytes={currentScan?.totalBytes || 0}
              limit={5}
            />
          </div>
        </div>

        {/* File Format Distribution Chart (4 cols) */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    File Format Distribution
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Breakdown by extension (.PDF, .DOCX, .PNG)
                  </p>
                </div>
              </div>
            </div>
            <FormatDistributionChart
              files={currentScan?.files || []}
              totalBytes={currentScan?.totalBytes || 0}
            />
          </div>
        </div>

        {/* File Activity Over Time Chart (4 cols) */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    File Activity Over Time
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    7-day processing & conversion trend
                  </p>
                </div>
              </div>
            </div>
            <ActivityTrendChart activities={activities} />
          </div>
        </div>
      </div>

      {/* 5. Quick Actions, Recently Used & Favorite Tools Directory */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Quick Actions & Tool Shortcuts
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Instant access to featured workspaces, recently used tools, and your pinned favorites
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setToolTab("featured")}
                className={clsx(
                  "px-3 py-1 rounded-lg transition-all cursor-pointer",
                  toolTab === "featured"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                Featured ({featuredShortcuts.length})
              </button>
              <button
                type="button"
                onClick={() => setToolTab("recent")}
                className={clsx(
                  "px-3 py-1 rounded-lg transition-all cursor-pointer",
                  toolTab === "recent"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                Recently Used ({recentToolsList.length})
              </button>
              <button
                type="button"
                onClick={() => setToolTab("favorites")}
                className={clsx(
                  "px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer",
                  toolTab === "favorites"
                    ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Star className="w-3 h-3 fill-current" />
                <span>Favorites ({favoriteToolsList.length})</span>
              </button>
            </div>

            <Link
              href="/pdf"
              className="hidden sm:inline-flex text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline items-center gap-1 ml-2"
            >
              <span>All {TOOLS.length} tools</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {toolTab === "featured" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredShortcuts.map((tool) => {
              const Icon = tool.icon;
              const isFav = favorites.includes(tool.toolId);
              return (
                <div
                  key={tool.id}
                  className="group relative p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500 hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <Link
                        href={tool.href}
                        className={clsx(
                          "w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105",
                          tool.color
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="text-2xs font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300">
                          {tool.engine}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(tool.toolId)}
                          title={isFav ? "Remove from favorites" : "Pin to favorites"}
                          className={clsx(
                            "p-1.5 rounded-lg transition-colors cursor-pointer",
                            isFav
                              ? "text-amber-400 hover:bg-amber-950/40"
                              : "text-slate-500 hover:text-amber-400"
                          )}
                        >
                          <Star className={clsx("w-4 h-4", isFav && "fill-current")} />
                        </button>
                      </div>
                    </div>
                    <Link href={tool.href} className="block mt-3.5">
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                        {tool.desc}
                      </p>
                    </Link>
                  </div>
                  <Link
                    href={tool.href}
                    className="pt-4 mt-2 flex items-center text-xs font-semibold text-blue-400 group-hover:translate-x-0.5 transition-transform"
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {toolTab === "recent" && (
          <div>
            {recentToolsList.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 text-center text-xs text-slate-400">
                No tools executed in this session yet. Use any tool above and it will appear here automatically.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {recentToolsList.map((t) => {
                  const Icon = t.icon;
                  return (
                    <Link
                      key={t.id}
                      href={t.href}
                      className="group p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-400 transition-all flex items-center gap-3.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {t.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {t.description}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {toolTab === "favorites" && (
          <div>
            {favoriteToolsList.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 text-center text-xs text-slate-400">
                Click the star icon on any tool card to pin it to your Favorites bar and Sidebar.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {favoriteToolsList.map((t) => {
                  const Icon = t.icon;
                  return (
                    <div
                      key={t.id}
                      className="group p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-amber-400 transition-all flex items-center gap-3.5"
                    >
                      <Link
                        href={t.href}
                        className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"
                      >
                        <Icon className="w-5 h-5" />
                      </Link>
                      <Link href={t.href} className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {t.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {t.description}
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(t.id)}
                        className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg cursor-pointer"
                        title="Unpin favorite"
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. Recent Processing Timeline */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Recent Processing Audit Trail
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Real-time log of conversions, scans, and compressions executed in this browser
            </p>
          </div>
          <Link
            href="/recent"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>Open Output Archive</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="mt-3">
          {activities.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
              No processing activity logged yet. Drop a file above or launch any tool to begin.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {activities.slice(0, 6).map((act) => (
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
                    {act.bytesIn ? (
                      <div className="text-[10px] text-slate-500 font-mono metric-number">
                        {formatBytes(act.bytesIn)}
                        {act.bytesOut ? ` → ${formatBytes(act.bytesOut)}` : ""}
                      </div>
                    ) : null}
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

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading TWOOLKIT Workspace...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
