"use client";

import { useHistory } from "@/stores/history";
import { formatBytes, formatRelative, formatDate } from "@/lib/fileTypes";
import {
  History,
  Download,
  Trash2,
  FileText,
  Search,
  ExternalLink,
  Shield,
  Layers,
  Database,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

export default function RecentFilesPage() {
  const { outputs, activities, getOutputBlob, removeOutput, clearOutputs, clearActivities } = useHistory();
  const [activeTab, setActiveTab] = useState<"outputs" | "activities">("outputs");
  const [search, setSearch] = useState("");

  const filteredOutputs = outputs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.tool.toLowerCase().includes(search.toLowerCase()) ||
      o.sourceNames.some((s) => s.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDownloadOutput = async (id: string, name: string) => {
    const blob = await getOutputBlob(id);
    if (!blob) {
      alert("This output file is no longer stored in the browser's IndexedDB cache.");
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const totalStoredBytes = outputs.filter((o) => o.stored).reduce((a, o) => a + o.size, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <History className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Recent Files & Output Archive
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Review conversions, inspect processing logs, and re-download saved outputs directly from local IndexedDB cache.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start">
          <div className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
            {formatBytes(totalStoredBytes)} cached
          </div>
          {outputs.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Clear all stored outputs from your browser's IndexedDB cache?")) void clearOutputs();
              }}
              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear all stored outputs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab("outputs")}
            className={clsx(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === "outputs"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            Processed Outputs ({outputs.length})
          </button>
          <button
            onClick={() => setActiveTab("activities")}
            className={clsx(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === "activities"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            Activity Timeline ({activities.length})
          </button>
        </div>

        <div className="w-full sm:w-64">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs shadow-2xs">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search outputs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Outputs List Table */}
      {activeTab === "outputs" && (
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Output Filename</th>
                <th className="py-2.5 px-4">Size</th>
                <th className="py-2.5 px-4">Origin Tool</th>
                <th className="py-2.5 px-4">Created</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredOutputs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    No processed files found. Completed conversions and downloads will be archived here.
                  </td>
                </tr>
              ) : (
                filteredOutputs.map((out) => (
                  <tr key={out.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white max-w-xs truncate">
                      {out.name}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">
                      {formatBytes(out.size)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 uppercase">
                        {out.tool}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                      {formatRelative(out.ts)}
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => handleDownloadOutput(out.id, out.name)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 hover:bg-blue-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </button>
                      <button
                        onClick={() => removeOutput(out.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Delete from cache"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Activity Timeline List */}
      {activeTab === "activities" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs divide-y divide-slate-100 dark:divide-slate-800">
          {activities.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No recent activity recorded yet.
            </div>
          ) : (
            activities.map((act) => (
              <div
                key={act.id}
                className="py-3 flex items-center justify-between text-xs"
              >
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
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {act.detail}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-400 ml-4 shrink-0">
                  {formatDate(act.ts)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
