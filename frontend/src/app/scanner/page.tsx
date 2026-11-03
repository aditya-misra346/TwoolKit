"use client";

import { useState } from "react";
import { useScanStore } from "@/stores/scanStore";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { analyzeFile } from "@/lib/scanner";
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
} from "lucide-react";
import clsx from "clsx";

type Tab = "all" | "duplicates" | "large" | "security";

export default function ScannerPage() {
  const { currentScan, isScanning, scanProgress, currentScanStage, setScanResult, updateScanProgress, moveToTrash } = useScanStore();
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"size-desc" | "size-asc" | "date-desc" | "date-asc" | "name">("size-desc");
  const [selectedDuplicates, setSelectedDuplicates] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState(false);

  // Scan execution
  const handleFilesSelected = async (staged: StagedFile[]) => {
    updateScanProgress(0, "Preparing files for scan");
    const scanned = [];
    const total = staged.length;

    for (let i = 0; i < total; i++) {
      const f = staged[i];
      updateScanProgress(i / total, `Analyzing ${f.name} (${i + 1}/${total})`);
      const analyzed = await analyzeFile(f.file, f.path);
      scanned.push(analyzed);
    }

    updateScanProgress(0.98, "Compiling file categories & duplicate analysis");
    await setScanResult(scanned);
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

  // Duplicate selection helper
  const toggleSelectDuplicate = (fileId: string) => {
    setSelectedDuplicates((prev) => ({ ...prev, [fileId]: !prev[fileId] }));
  };

  const selectRecommendedDuplicates = () => {
    if (!currentScan) return;
    const patch: Record<string, boolean> = {};
    for (const group of currentScan.duplicateGroups) {
      for (const file of group.files) {
        // Select all except the recommended keep file
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
    if (confirm(`Move ${idsToDelete.length} duplicate file(s) to the in-app Recycle Bin? You can restore them anytime from the Storage Manager.`)) {
      setIsDeleting(true);
      await moveToTrash(idsToDelete, "Duplicate cleanup");
      setSelectedDuplicates({});
      setIsDeleting(false);
    }
  };

  const selectedCount = Object.values(selectedDuplicates).filter(Boolean).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <ScanSearch className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Advanced File Scanner
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            In-depth analysis of files, folder structures, cryptographic hashes, perceptual image duplicates, and file anomalies.
          </p>
        </div>
      </div>

      {/* Intake Dropzone */}
      <DropZone
        onFilesSelected={handleFilesSelected}
        title="Upload files or select a folder to scan"
        description="Scans file signatures, hashes (SHA-256), MIME types, and detects exact/perceptual duplicates."
      />

      {/* Live Scanning Progress */}
      {isScanning && (
        <div className="p-6 rounded-3xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-200">
            <span>{currentScanStage}</span>
            <span>{Math.round(scanProgress * 100)}%</span>
          </div>
          <div className="w-full bg-blue-200/60 dark:bg-blue-900/60 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-200"
              style={{ width: `${Math.round(scanProgress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Scan Results Display */}
      {currentScan && (
        <div className="space-y-6">
          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={clsx(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0",
                activeTab === "all"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <span>All Scanned Files</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 dark:bg-black/20">
                {currentScan.files.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("duplicates")}
              className={clsx(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0",
                activeTab === "duplicates"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate Detection</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white">
                {currentScan.duplicateGroups.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("large")}
              className={clsx(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0",
                activeTab === "large"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Large Files ({currentScan.largeFiles.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("security")}
              className={clsx(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0",
                activeTab === "security"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Security & Integrity</span>
              {currentScan.suspiciousFiles.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                  {currentScan.suspiciousFiles.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: ALL SCANNED FILES */}
          {activeTab === "all" && (
            <div className="space-y-4">
              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
                <div className="flex items-center gap-2 flex-1 w-full max-w-md">
                  <Search className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                  <input
                    type="text"
                    placeholder="Search by filename or path..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden"
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
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden"
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
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4">File Name / Path</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Size</th>
                        <th className="py-3 px-4">Detected Signature</th>
                        <th className="py-3 px-4">SHA-256 Hash</th>
                        <th className="py-3 px-4">Modified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {filteredFiles.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No files match the search filters.
                          </td>
                        </tr>
                      ) : (
                        filteredFiles.map((f) => (
                          <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4 font-medium text-slate-900 dark:text-white max-w-xs truncate" title={f.path}>
                              {f.path}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold uppercase">
                                {f.category}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono">{formatBytes(f.size)}</td>
                            <td className="py-3 px-4">
                              {f.detectedSignature ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  {f.detectedSignature.label}
                                </span>
                              ) : (
                                <span className="text-slate-400">Generic text/data</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-[10px] text-slate-400 max-w-[120px] truncate" title={f.sha256}>
                              {f.sha256 || "—"}
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
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
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
                <div>
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <Copy className="w-4 h-4 text-amber-600" />
                    Intelligent Duplicate Finder
                  </h3>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                    Identifies exact byte duplicates (SHA-256), visually similar photos (pHash), and conflicting filenames.
                    Review each file before deletion. Files moved to trash can be restored.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={selectRecommendedDuplicates}
                    className="px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 transition-colors"
                  >
                    Select Recommended
                  </button>
                  {selectedCount > 0 && (
                    <button
                      onClick={handleDeleteSelectedDuplicates}
                      disabled={isDeleting}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Selected ({selectedCount})
                    </button>
                  )}
                </div>
              </div>

              {currentScan.duplicateGroups.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400">
                  <ShieldCheck className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No duplicate files found!
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    All scanned files have distinct contents and unique hashes.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentScan.duplicateGroups.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={clsx(
                              "px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase",
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
                              ? "Visually Similar Photo"
                              : "Same Name · Different Contents"}
                          </span>
                          <span className="text-slate-400 font-semibold">
                            {group.files.length} copies
                          </span>
                        </div>
                        {group.totalWastedBytes > 0 && (
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            Wastes {formatBytes(group.totalWastedBytes)}
                          </span>
                        )}
                      </div>

                      {/* Duplicate Items */}
                      <div className="space-y-2">
                        {group.files.map((file) => {
                          const isKeep = file.id === group.recommendedKeepId;
                          const isSelected = !!selectedDuplicates[file.id];
                          return (
                            <div
                              key={file.id}
                              onClick={() => toggleSelectDuplicate(file.id)}
                              className={clsx(
                                "p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all",
                                isSelected
                                  ? "border-rose-400 bg-rose-50/60 dark:bg-rose-950/40"
                                  : "border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300"
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="p-1 text-slate-400">
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
                                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
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
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200">
                Showing files larger than 5 MB sorted descending by size. Large files are prime candidates for compression or archiving.
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Filename</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Modified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentScan.largeFiles.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          No large files (&gt; 5 MB) detected in this scan.
                        </td>
                      </tr>
                    ) : (
                      currentScan.largeFiles.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white truncate max-w-sm">
                            {f.path}
                          </td>
                          <td className="py-3 px-4 font-bold text-blue-600 dark:text-blue-400 font-mono">
                            {formatBytes(f.size)}
                          </td>
                          <td className="py-3 px-4 uppercase text-[10px] text-slate-500 font-semibold">
                            {f.category}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {formatDate(f.lastModified)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY & ANOMALIES */}
          {activeTab === "security" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
                File integrity inspection detects hidden executable headers, right-to-left extension spoofing, double extensions, and magic-byte mismatches.
              </div>

              {currentScan.suspiciousFiles.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <ShieldCheck className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    All file signatures verified
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    No disguised executables or extension mismatches were detected.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentScan.suspiciousFiles.map((file) => (
                    <div
                      key={file.id}
                      className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 space-y-2 text-xs"
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
