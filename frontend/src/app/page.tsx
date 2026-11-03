"use client";

import { useScanStore } from "@/stores/scanStore";
import { useHistory } from "@/stores/history";
import { StorageChart } from "@/components/StorageChart";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { TOOLS, QUICK_ACTIONS } from "@/lib/tools";
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
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

export default function DashboardPage() {
  const router = useRouter();
  const { currentScan, setScanResult } = useScanStore();
  const { stats, activities } = useHistory();

  // Storage breakdown from scan or empty
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

  const quickActionTools = QUICK_ACTIONS.map((id) => TOOLS.find((t) => t.id === id)).filter(Boolean);

  const handleFilesDropped = async (staged: StagedFile[]) => {
    router.push("/scanner");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            File Management Ecosystem
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            All-in-one workstation for document scanning, storage organization, format conversion, and compression.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/scanner"
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 shrink-0"
          >
            <ScanSearch className="w-4 h-4" />
            Scan New Folder
          </Link>
          <Link
            href="/storage"
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors shrink-0"
          >
            Manage Storage
          </Link>
        </div>
      </div>

      {/* Storage & Statistics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Storage Distribution Card (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Storage Breakdown
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Distribution across analyzed files and folders
              </p>
            </div>
            {currentScan && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {currentScan.files.length} Files Analyzed
              </span>
            )}
          </div>

          <div className="py-6">
            <StorageChart
              bucketBytes={storageBreakdown}
              totalBytes={currentScan?.totalBytes ?? 0}
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span>
              Wasted in duplicate copies:{" "}
              <strong className="text-slate-900 dark:text-white font-semibold">
                {formatBytes(
                  currentScan?.duplicateGroups.reduce((acc, g) => acc + g.totalWastedBytes, 0) || 0
                )}
              </strong>
            </span>
            <Link
              href="/storage"
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
            >
              Storage cleanup <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Real Statistics Metrics Grid (5 cols) */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-4">
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Analyzed Files</span>
              <Layers className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {currentScan ? currentScan.files.length.toLocaleString() : "0"}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                across {currentScan ? currentScan.folders.length : 0} folder(s)
              </div>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Duplicates</span>
              <Copy className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {currentScan ? currentScan.duplicateGroups.length : 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {currentScan
                  ? `${formatBytes(currentScan.duplicateGroups.reduce((a, g) => a + g.totalWastedBytes, 0))} reclaimable`
                  : "No duplicates found"}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Conversions</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {stats.filesConverted.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {stats.tasksCompleted} tasks completed
              </div>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Storage Saved</span>
              <TrendingDown className="w-4 h-4 text-purple-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {formatBytes(stats.bytesSavedByCompression)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                by {stats.filesCompressed} compressed files
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Universal Quick Actions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Frequently Used Tools
          </h2>
          <Link
            href="/pdf"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            Explore all {TOOLS.length} tools <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          {quickActionTools.map((tool) => {
            if (!tool) return null;
            const Icon = tool.icon;
            return (
              <Link
                key={tool.id}
                href={tool.href}
                className="group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xs">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {tool.engine === "local" ? "Browser" : "Server"}
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {tool.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {tool.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Universal Drag & Drop Workspace on Dashboard */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-3">
          Drop Files to Start
        </h2>
        <DropZone
          onFilesSelected={handleFilesDropped}
          title="Drop any documents, images, or folders here"
          description="Vellum will detect the file types and suggest the appropriate conversion, compression, or organization tools."
        />
      </div>

      {/* Recent Activity Timeline */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Recent Processing Timeline
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              History of conversions, scans, and compressions performed in this browser
            </p>
          </div>
          <Link
            href="/recent"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all history
          </Link>
        </div>

        <div className="mt-4">
          {activities.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              No processing activity logged yet. Upload or scan files to get started.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {activities.slice(0, 5).map((act) => (
                <div key={act.id} className="py-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 min-w-0">
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
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
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
