"use client";

import { useState, useMemo } from "react";
import { useScanStore, type TrashItem } from "@/stores/scanStore";
import { StorageChart } from "@/components/StorageChart";
import {
  FolderStorageBarChart,
  LargestFilesBarChart,
} from "@/components/AnalyticsCharts";
import { formatBytes, formatDate, bucketOf, type StorageBucket } from "@/lib/fileTypes";
import {
  HardDrive,
  Sparkles,
  Trash2,
  RotateCcw,
  AlertTriangle,
  FolderTree,
  FileText,
  Clock,
  ArrowRight,
  CheckCircle2,
  Shield,
  Layers,
  Edit2,
  Check,
  X,
  Search,
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

export default function StorageManagerPage() {
  const { currentScan, trash, moveToTrash, restoreFromTrash, emptyTrash, renameFile } = useScanStore();
  const [activeTab, setActiveTab] = useState<"overview" | "cleanup" | "files" | "trash">("overview");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [fileSearch, setFileSearch] = useState("");

  // Compute smart cleanup recommendations from current scan
  const recommendations = useMemo(() => {
    if (!currentScan) return [];
    const list = [];

    // 1. Duplicate files
    const dupBytes = currentScan.duplicateGroups.reduce((a, g) => a + g.totalWastedBytes, 0);
    const dupFileIds = currentScan.duplicateGroups.flatMap((g) =>
      g.files.filter((f) => f.id !== g.recommendedKeepId).map((f) => f.id)
    );
    if (dupBytes > 0) {
      list.push({
        id: "duplicates",
        title: "Redundant Duplicate Copies",
        desc: "Exact byte duplicates (SHA-256) and identical images wasting space across scanned folders.",
        recoverableBytes: dupBytes,
        fileIds: dupFileIds,
        badge: `${dupFileIds.length} copies`,
        badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
      });
    }

    // 2. Large files > 20 MB
    const veryLarge = currentScan.files.filter((f) => f.size >= 20 * 1024 * 1024);
    if (veryLarge.length > 0) {
      const largeBytes = veryLarge.reduce((a, f) => a + f.size, 0);
      list.push({
        id: "large",
        title: "Heavy Media & Oversized Documents (>20MB)",
        desc: "Individual files consuming substantial disk space that could be compressed or archived.",
        recoverableBytes: largeBytes,
        fileIds: veryLarge.map((f) => f.id),
        badge: `${veryLarge.length} files`,
        badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
      });
    }

    // 3. Temporary or cache files (.tmp, .bak, .log, .DS_Store, ~$*)
    const tempFiles = currentScan.files.filter(
      (f) =>
        f.name.startsWith("~$") ||
        f.name === ".DS_Store" ||
        ["tmp", "bak", "log", "cache", "crdownload"].includes(f.extension.toLowerCase())
    );
    if (tempFiles.length > 0) {
      const tempBytes = tempFiles.reduce((a, f) => a + f.size, 0);
      list.push({
        id: "temp",
        title: "Temporary Leftover & Cache Files",
        desc: "Auto-save copies, thumbnail caches, and temporary files that can be safely discarded.",
        recoverableBytes: tempBytes,
        fileIds: tempFiles.map((f) => f.id),
        badge: `${tempFiles.length} files`,
        badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
      });
    }

    return list;
  }, [currentScan]);

  const totalRecoverable = recommendations.reduce((a, r) => a + r.recoverableBytes, 0);

  const handleApplyCleanup = async (rec: (typeof recommendations)[0]) => {
    if (confirm(`Move ${rec.fileIds.length} file(s) (${formatBytes(rec.recoverableBytes)}) to the in-app Recycle Bin?`)) {
      await moveToTrash(rec.fileIds, rec.title);
    }
  };

  const handleStartRename = (id: string, curName: string) => {
    setRenamingId(id);
    setRenameVal(curName);
  };

  const handleSaveRename = (id: string) => {
    if (renameVal.trim()) {
      renameFile(id, renameVal.trim());
    }
    setRenamingId(null);
  };

  // Buckets for chart
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

  const filteredFileManagerFiles = useMemo(() => {
    if (!currentScan) return [];
    if (!fileSearch.trim()) return currentScan.files;
    const q = fileSearch.toLowerCase();
    return currentScan.files.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
  }, [currentScan, fileSearch]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <HardDrive className="w-7 h-7 text-blue-600 dark:text-blue-400 shrink-0" />
            Storage Manager & Smart Cleanup
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
            Desktop-grade storage breakdown, automated waste detection, file organization, and non-destructive virtual recycling bin.
          </p>
        </div>

        {trash.length > 0 && (
          <button
            onClick={() => setActiveTab("trash")}
            className="px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 text-xs sm:text-sm font-semibold flex items-center gap-2 self-start cursor-pointer hover:bg-amber-100 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-amber-600" />
            <span>Recycle Bin ({trash.length})</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0",
            activeTab === "overview"
              ? "bg-blue-600 text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          Storage Overview
        </button>
        <button
          onClick={() => setActiveTab("cleanup")}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0",
            activeTab === "cleanup"
              ? "bg-blue-600 text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Smart Cleanup ({recommendations.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("files")}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0",
            activeTab === "files"
              ? "bg-blue-600 text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          File Explorer ({currentScan?.files.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("trash")}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0",
            activeTab === "trash"
              ? "bg-blue-600 text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          <Trash2 className="w-4 h-4" />
          <span>Recycle Bin ({trash.length})</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-4">
                Current Storage Allocation (Donut, Pie & Bar Views)
              </h2>
              <StorageChart
                bucketBytes={storageBreakdown}
                bucketCounts={storageCounts}
                totalBytes={currentScan?.totalBytes || 0}
              />
            </div>

            <div className="lg:col-span-4 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                  Estimated Cleanable Space
                </span>
                <div className="text-2xl sm:text-3xl font-black mt-1.5 tracking-tight metric-number">
                  {formatBytes(totalRecoverable)}
                </div>
                <p className="text-xs text-blue-100/90 mt-2 leading-relaxed">
                  Calculated from verified redundant duplicates, oversized media, and temporary cache files.
                </p>
              </div>

              <div className="pt-5">
                <button
                  onClick={() => setActiveTab("cleanup")}
                  className="w-full py-2 px-3 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Review Cleanup Suggestions</span>
                </button>
              </div>
            </div>
          </div>

          {/* Directory Breakdown & Largest Files Bar Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1">
                Storage by Directory / Folder
              </h2>
              <p className="text-[11px] text-slate-400 mb-4">
                Horizontal comparison of storage consumed across scanned folders
              </p>
              <FolderStorageBarChart
                files={currentScan?.files || []}
                totalBytes={currentScan?.totalBytes || 0}
              />
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1">
                Largest Individual Files
              </h2>
              <p className="text-[11px] text-slate-400 mb-4">
                Top storage-heavy files ranked by byte footprint
              </p>
              <LargestFilesBarChart
                files={currentScan?.files || []}
                totalBytes={currentScan?.totalBytes || 0}
                limit={6}
              />
            </div>
          </div>

          {/* Privacy & Sandbox Notice */}
          <div className="p-3.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Secure Sandboxed Storage Access
              </span>
              <p className="leading-relaxed text-[11px]">
                TWOOLKIT operates in accordance with web sandbox security. Only directories and files you explicitly select or drag into the workspace are scanned. System-wide disk bypasses are never performed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SMART CLEANUP */}
      {activeTab === "cleanup" && (
        <div className="space-y-3">
          {recommendations.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Storage is clean and optimized!
              </p>
              <p className="text-xs text-slate-400 mt-1">
                No duplicate copies, excessive temporary files, or unneeded cache files found.
              </p>
            </div>
          ) : (
            recommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {rec.title}
                    </h3>
                    <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase", rec.badgeColor)}>
                      {rec.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
                    {rec.desc}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-medium block">Recoverable</span>
                    <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                      {formatBytes(rec.recoverableBytes)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleApplyCleanup(rec)}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Move to Bin</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: FILE MANAGER (RENAME, DELETE) */}
      {activeTab === "files" && (
        <div className="space-y-3">
          {/* Search bar */}
          <div className="flex items-center gap-2 p-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search loaded files..."
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden"
            />
          </div>

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Filename / Path</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {!currentScan || currentScan.files.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No files currently loaded. Scan a folder in the File Scanner first.
                      </td>
                    </tr>
                  ) : filteredFileManagerFiles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No files match &quot;{fileSearch}&quot;.
                      </td>
                    </tr>
                  ) : (
                    filteredFileManagerFiles.map((file) => (
                      <tr key={file.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white max-w-sm">
                          {renamingId === file.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={renameVal}
                                onChange={(e) => setRenameVal(e.target.value)}
                                autoFocus
                                className="px-2.5 py-1 rounded border border-blue-500 text-xs sm:text-sm w-full bg-white dark:bg-slate-800 focus:outline-hidden"
                              />
                              <button
                                onClick={() => handleSaveRename(file.id)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setRenamingId(null)}
                                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="truncate block" title={file.path}>
                              {file.path}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">{formatBytes(file.size)}</td>
                        <td className="py-3.5 px-4 uppercase text-xs text-slate-400 font-semibold">
                          {file.category}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => handleStartRename(file.id, file.name)}
                            className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Rename file"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveToTrash([file.id], "Manual deletion")}
                            className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Move to Recycle Bin"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RECYCLE BIN */}
      {activeTab === "trash" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs">
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-200 block">
                Virtual In-App Recycle Bin
              </span>
              <span className="text-amber-700 dark:text-amber-300 text-[11px]">
                Files deleted within TWOOLKIT can be restored back to your active session.
              </span>
            </div>
            {trash.length > 0 && (
              <button
                onClick={emptyTrash}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-2xs cursor-pointer"
              >
                Empty Recycle Bin
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Filename</th>
                  <th className="py-2.5 px-4">Size</th>
                  <th className="py-2.5 px-4">Reason</th>
                  <th className="py-2.5 px-4">Deleted At</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {trash.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Recycle bin is empty.
                    </td>
                  </tr>
                ) : (
                  trash.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white truncate max-w-xs">
                        {item.originalFile.name}
                      </td>
                      <td className="py-2.5 px-4 font-mono">{formatBytes(item.originalFile.size)}</td>
                      <td className="py-2.5 px-4 text-slate-500">{item.reason}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                        {formatDate(item.deletedAt)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => restoreFromTrash([item.id])}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
