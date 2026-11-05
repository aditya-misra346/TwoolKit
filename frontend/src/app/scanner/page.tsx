"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useScanStore } from "@/stores/scanStore";
import { DropZone, type StagedFile } from "@/components/DropZone";
import {
  LargestFilesBarChart,
  FormatDistributionChart,
} from "@/components/AnalyticsCharts";
import { analyzeFile } from "@/lib/scanner";
import {
  isTauriDesktop,
  authorizeDesktopDirectory,
  scanAuthorizedDirectoryNative,
} from "@/lib/desktop";
import { formatBytes, formatDate, CATEGORY_LABEL, type Category } from "@/lib/fileTypes";
import {
  ScanSearch,
  Copy,
  ShieldAlert,
  ArrowUpDown,
  Filter,
  Search,
  Check,
  Trash2,
  FileText,
  AlertTriangle,
  FolderTree,
  ExternalLink,
  ShieldCheck,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Layers,
  HardDrive,
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

type Tab = "all" | "duplicates" | "large" | "security";

function ScannerContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const initialTab: Tab = (tabParam === "duplicates" || tabParam === "large" || tabParam === "security") ? tabParam : "all";
  const { currentScan, isScanning, scanProgress, currentScanStage, setScanResult, updateScanProgress, moveToTrash } = useScanStore();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"size-desc" | "size-asc" | "date-desc" | "date-asc" | "name">("size-desc");
  const [selectedDuplicates, setSelectedDuplicates] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState(false);

  // Scan execution
  const handleFilesSelected = async (staged: StagedFile[]) => {
    updateScanProgress(0, "Preparing files for deep analysis");
    const scanned = [];
    const total = staged.length;

    for (let i = 0; i < total; i++) {
      const f = staged[i];
      updateScanProgress(i / total, `Analyzing ${f.name} (${i + 1}/${total})`);
      const analyzed = await analyzeFile(f.file, f.path);
      scanned.push(analyzed);
    }

    updateScanProgress(0.98, "Calculating hashes & duplicate clusters");
    await setScanResult(scanned);
  };

  // Native Desktop Rust Folder Scan
  const handleNativeFolderScan = async () => {
    try {
      const dirPath = await authorizeDesktopDirectory();
      if (!dirPath) return;
      updateScanProgress(0.15, `Scanning authorized folder: ${dirPath}`);
      const scanned = await scanAuthorizedDirectoryNative(dirPath);
      updateScanProgress(0.95, "Indexing SHA-256 hashes & duplicate clusters");
      await setScanResult(scanned);
    } catch (e: any) {
      alert(e?.message || "Native folder scan requires TwoolKit Desktop.");
    }
  };

  // Filtered files for "all" tab
  const filteredFiles = (currentScan?.files || [])
    .filter((f) => {
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase()) && !f.path.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "size-desc") return b.size - a.size;
      if (sortBy === "size-asc") return a.size - b.size;
      if (sortBy === "date-desc") return b.lastModified - a.lastModified;
      if (sortBy === "date-asc") return a.lastModified - b.lastModified;
      return a.name.localeCompare(b.name);
    });

  const toggleSelectDuplicate = (fileId: string) => {
    setSelectedDuplicates((prev) => ({ ...prev, [fileId]: !prev[fileId] }));
  };

  const selectRecommendedDuplicates = () => {
    if (!currentScan) return;
    const patch: Record<string, boolean> = {};
    for (const group of currentScan.duplicateGroups) {
      for (const file of group.files) {
        if (file.id !== group.recommendedKeepId) {
          patch[file.id] = true;
        }
      }
    }
    setSelectedDuplicates(patch);
  };

  const handleDeleteSelectedDuplicates = async () => {
    const idsToDelete = Object.keys(selectedDuplicates).filter((id) => selectedDuplicates[id]);
    if (idsToDelete.length === 0) return;
    if (confirm(`Move ${idsToDelete.length} duplicate copy(ies) to the in-app Recycle Bin? You can restore them anytime from the Storage Manager.`)) {
      setIsDeleting(true);
      await moveToTrash(idsToDelete, "Duplicate cleanup");
      setSelectedDuplicates({});
      setIsDeleting(false);
    }
  };

  const selectedCount = Object.values(selectedDuplicates).filter(Boolean).length;
  const totalWastedBytes = currentScan?.duplicateGroups.reduce((a, g) => a + g.totalWastedBytes, 0) || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <ScanSearch className="w-7 h-7 text-blue-600 dark:text-blue-400 shrink-0" />
            Advanced File Scanner & Duplicate Finder
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
            In-depth inspection of file signatures, SHA-256 cryptographic hashes, perceptual image duplicates, and integrity anomalies.
          </p>
        </div>

        {isTauriDesktop() && (
          <button
            type="button"
            onClick={handleNativeFolderScan}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors flex items-center gap-2 self-start cursor-pointer"
          >
            <FolderTree className="w-4 h-4" />
            <span>Scan Local Folder (Native Rust)</span>
          </button>
        )}
      </div>

      {/* Intake Dropzone */}
      <DropZone
        onFilesSelected={handleFilesSelected}
        title="Upload files or select a folder to analyze"
        description="Extracts MIME types, validates magic bytes, computes hashes, and detects exact and visual duplicate groups."
      />

      {/* Live Scanning Progress */}
      {isScanning && (
        <div className="p-5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-200">
            <span>{currentScanStage}</span>
            <span className="font-mono">{Math.round(scanProgress * 100)}%</span>
          </div>
          <div className="w-full bg-blue-200/60 dark:bg-blue-900/60 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-150"
              style={{ width: `${Math.round(scanProgress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Workspace */}
      {currentScan && (
        <div className="space-y-6">
          {/* Executive Overview Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Scanned</span>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                {currentScan.files.length} files
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{formatBytes(currentScan.totalBytes)}</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Duplicate Groups</span>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
                {currentScan.duplicateGroups.length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{formatBytes(totalWastedBytes)} reclaimable</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Large Files (&gt;5MB)</span>
              <div className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1">
                {currentScan.largeFiles.length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Heavy storage consumers</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Security Anomalies</span>
              <div className={clsx(
                "text-lg font-black mt-1",
                currentScan.suspiciousFiles.length > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
              )}>
                {currentScan.suspiciousFiles.length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {currentScan.suspiciousFiles.length === 0 ? "All verified clean" : "Issues detected"}
              </div>
            </div>
          </div>

          {/* Interactive Visual Telemetry Grid (Format Distribution + Largest Files Bar Chart) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-3">
                Scanned File Type & Format Distribution
              </h2>
              <FormatDistributionChart
                files={currentScan.files}
                totalBytes={currentScan.totalBytes}
              />
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-3">
                Top Storage Consumers (Horizontal Bar Comparison)
              </h2>
              <LargestFilesBarChart
                files={currentScan.files}
                totalBytes={currentScan.totalBytes}
                limit={5}
              />
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={clsx(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer",
                activeTab === "all"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <span>All Scanned Files</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 dark:bg-black/20">
                {currentScan.files.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("duplicates")}
              className={clsx(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer",
                activeTab === "duplicates"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate Groups</span>
              {currentScan.duplicateGroups.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                  {currentScan.duplicateGroups.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("large")}
              className={clsx(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer",
                activeTab === "large"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Large Files ({currentScan.largeFiles.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("security")}
              className={clsx(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer",
                activeTab === "security"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Security & Integrity</span>
              {currentScan.suspiciousFiles.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                  {currentScan.suspiciousFiles.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: ALL SCANNED FILES */}
          {activeTab === "all" && (
            <div className="space-y-3">
              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
                <div className="flex items-center gap-2 flex-1 w-full max-w-md">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
                  <input
                    type="text"
                    placeholder="Search by filename or folder path..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden"
                  >
                    <option value="all">All Categories</option>
                    {Object.keys(currentScan.categoryCounts).map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABEL[cat as Category] || cat} ({currentScan.categoryCounts[cat as Category] || 0})
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden"
                  >
                    <option value="size-desc">Largest First</option>
                    <option value="size-asc">Smallest First</option>
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="name">Name A-Z</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4">File Name / Path</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Size</th>
                        <th className="py-3 px-4">Signature</th>
                        <th className="py-3 px-4">SHA-256 Hash</th>
                        <th className="py-3 px-4">Modified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {filteredFiles.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No files match the filters.
                          </td>
                        </tr>
                      ) : (
                        filteredFiles.map((f) => (
                          <tr key={f.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white max-w-sm truncate" title={f.path}>
                              {f.path}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold uppercase">
                                {f.category}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">{formatBytes(f.size)}</td>
                            <td className="py-3.5 px-4">
                              {f.detectedSignature ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  {f.detectedSignature.label}
                                </span>
                              ) : (
                                <span className="text-slate-400">Generic</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-400 max-w-[140px] truncate" title={f.sha256}>
                              {f.sha256 || "—"}
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 text-xs whitespace-nowrap">
                              {formatDate(f.lastModified)}
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

          {/* TAB 2: DUPLICATE DETECTION */}
          {activeTab === "duplicates" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <Copy className="w-4 h-4 text-amber-600" />
                    Intelligent Duplicate Finder
                  </h3>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                    Identifies byte-identical duplicates (SHA-256) and visually similar photos (pHash). Select copies to move to the in-app Recycle Bin.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={selectRecommendedDuplicates}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950 transition-colors cursor-pointer"
                  >
                    Select Recommended
                  </button>
                  {selectedCount > 0 && (
                    <button
                      onClick={handleDeleteSelectedDuplicates}
                      disabled={isDeleting}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Move Selected to Bin ({selectedCount})
                    </button>
                  )}
                </div>
              </div>

              {currentScan.duplicateGroups.length === 0 ? (
                <div className="p-12 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400">
                  <ShieldCheck className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No duplicate files detected
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Every file has distinct contents and a unique cryptographic hash.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentScan.duplicateGroups.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={clsx(
                              "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase",
                              group.type === "exact"
                                ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                                : group.type === "similar_image"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                            )}
                          >
                            {group.type === "exact"
                              ? "Exact Content Duplicate"
                              : group.type === "similar_image"
                              ? "Visually Similar Image"
                              : "Same Name · Different Contents"}
                          </span>
                          <span className="text-slate-400 font-semibold">
                            {group.files.length} copies
                          </span>
                        </div>
                        {group.totalWastedBytes > 0 && (
                          <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono">
                            Wastes {formatBytes(group.totalWastedBytes)}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {group.files.map((file) => {
                          const isKeep = file.id === group.recommendedKeepId;
                          const isSelected = !!selectedDuplicates[file.id];
                          return (
                            <div
                              key={file.id}
                              onClick={() => toggleSelectDuplicate(file.id)}
                              className={clsx(
                                "p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all",
                                isSelected
                                  ? "border-rose-400 bg-rose-50/60 dark:bg-rose-950/40"
                                  : "border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300"
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="text-slate-400">
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                                    {file.path}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                    <span>{formatBytes(file.size)}</span>
                                    <span>·</span>
                                    <span>Modified {formatDate(file.lastModified)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {isKeep ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                    Recommended to Keep
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    Redundant Copy
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LARGE FILES */}
          {activeTab === "large" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200">
                Files larger than 5 MB sorted descending by size. Prime targets for compression or archiving.
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Filename</th>
                      <th className="py-2.5 px-4">Size</th>
                      <th className="py-2.5 px-4">Share of Scan</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4">Modified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentScan.largeFiles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No large files (&gt; 5 MB) detected in this scan.
                        </td>
                      </tr>
                    ) : (
                      currentScan.largeFiles.map((f) => {
                        const pct = currentScan.totalBytes > 0 ? (f.size / currentScan.totalBytes) * 100 : 0;
                        return (
                          <tr key={f.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white truncate max-w-sm">
                              {f.path}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-blue-600 dark:text-blue-400 font-mono">
                              {formatBytes(f.size)}
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-blue-600 h-full" style={{ width: `${Math.min(100, pct)}%` }} />
                                </div>
                                <span className="font-mono text-[10px] text-slate-400">{pct.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 uppercase text-[10px] text-slate-500 font-semibold">
                              {f.category}
                            </td>
                            <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                              {formatDate(f.lastModified)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY & ANOMALIES */}
          {activeTab === "security" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
                Integrity analysis detects hidden executable headers, right-to-left extension spoofing, double extensions, and magic-byte signature mismatches.
              </div>

              {currentScan.suspiciousFiles.length === 0 ? (
                <div className="p-12 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <ShieldCheck className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    All file signatures verified authentic
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    No disguised executables, double extensions, or extension mismatches detected.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {currentScan.suspiciousFiles.map((file) => (
                    <div
                      key={file.id}
                      className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-rose-900 dark:text-rose-200">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          <span>{file.name}</span>
                        </div>
                        <span className="font-mono text-slate-500">{formatBytes(file.size)}</span>
                      </div>
                      <div className="space-y-1 pl-6">
                        {file.suspiciousFindings.map((f, i) => (
                          <div key={i} className="text-rose-700 dark:text-rose-300">
                            <strong>{f.title}:</strong> {f.detail}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading Scanner...</div>}>
      <ScannerContent />
    </Suspense>
  );
}
