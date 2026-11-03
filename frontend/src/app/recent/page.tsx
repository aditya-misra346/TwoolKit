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
} from "lucide-react";
import { useState } from "react";

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
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <History className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Recent Files & Output Archive
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Access processed outputs, review operation history, and re-download saved files from IndexedDB.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start">
          <div className="text-xs px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
            {formatBytes(totalStoredBytes)} in browser cache
          </div>
          {outputs.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Clear all stored outputs from browser cache?")) void clearOutputs();
              }}
              className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Clear all stored outputs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("outputs")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "outputs"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Processed Outputs ({outputs.length})
          </button>
          <button
            onClick={() => setActiveTab("activities")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "activities"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Activity Timeline ({activities.length})
          </button>
        </div>

        <div className="w-48 sm:w-64">
          <input
            type="text"
            placeholder="Search recent files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
          />
        </div>
      </div>

      {/* Outputs List */}
      {activeTab === "outputs" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Output Filename</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Origin Tool</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredOutputs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    No processed files yet. Run any conversion or compression to save files here.
                  </td>
                </tr>
              ) : (
                filteredOutputs.map((out) => (
                  <tr key={out.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white max-w-xs truncate">
                      {out.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {formatBytes(out.size)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                        {out.tool}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {formatRelative(out.ts)}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleDownloadOutput(out.id, out.name)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 hover:bg-blue-100 transition-colors inline-flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                      <button
                        onClick={() => removeOutput(out.id)}
                        className="p-1 text-slate-400 hover:text-rose-500"
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
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          {activities.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No recent activity recorded.
            </div>
          ) : (
            activities.map((act) => (
              <div
                key={act.id}
                className="py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {act.title}
                  </div>
                  {act.detail && (
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {act.detail}
                    </div>
                  )}
                </div>
                <div className="text-right text-[11px] text-slate-400">
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
