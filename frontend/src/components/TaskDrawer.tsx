"use client";

import { useQueue, batchTasks, batchSummary } from "@/stores/tasks";
import { createZip } from "@/lib/archiveClient";
import { formatBytes } from "@/lib/fileTypes";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Download,
  Archive,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

export function TaskDrawer() {
  const {
    drawerOpen,
    setDrawer,
    batchOrder,
    batches,
    tasks,
    order,
    pause,
    resume,
    cancelBatch,
    cancelTask,
    retry,
    retryFailed,
    removeBatch,
    clearFinished,
  } = useQueue();

  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  const [downloadingZip, setDownloadingZip] = useState<string | null>(null);

  if (!drawerOpen) return null;

  const toggleExpand = (bId: string) => {
    setExpandedBatches((prev) => ({ ...prev, [bId]: !prev[bId] }));
  };

  const handleDownloadAll = async (batchId: string, batchTitle: string) => {
    const bTasks = batchTasks({ tasks, order } as any, batchId);
    const outputs = bTasks.flatMap((t) => t.outputs);
    if (outputs.length === 0) return;

    if (outputs.length === 1) {
      const o = outputs[0];
      const a = document.createElement("a");
      a.href = o.url;
      a.download = o.name;
      a.click();
      return;
    }

    try {
      setDownloadingZip(batchId);
      const zipBlob = await createZip(
        outputs.map((o) => ({ name: o.name, blob: o.blob }))
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${batchTitle.toLowerCase().replace(/[^a-z0-9]/g, "-")}-bundle.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloadingZip(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      onClick={() => setDrawer(false)}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Processing Queue
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {order.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live batch execution & download manager
            </p>
          </div>
          <div className="flex items-center gap-2">
            {order.length > 0 && (
              <button
                onClick={clearFinished}
                className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Clear completed tasks"
              >
                Clear Finished
              </button>
            )}
            <button
              onClick={() => setDrawer(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Batch Queue Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {batchOrder.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500 space-y-3">
              <Clock className="w-10 h-10 stroke-1 text-slate-300 dark:text-slate-600" />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Queue is empty</p>
                <p className="text-xs mt-1">Conversions and batch tasks will appear here as you run them.</p>
              </div>
            </div>
          ) : (
            batchOrder.map((batchId) => {
              const batch = batches[batchId];
              if (!batch) return null;
              const summary = batchSummary({ batches, tasks, order, batchOrder } as any, batchId);
              const bTasks = batchTasks({ tasks, order } as any, batchId);
              const isExpanded = expandedBatches[batchId] ?? true;

              return (
                <div
                  key={batchId}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 space-y-3"
                >
                  {/* Batch Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        {summary.running > 0 ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : summary.failed > 0 ? (
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                        ) : summary.completed === summary.total ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {batch.title}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {summary.completed} of {summary.total} completed
                          {summary.failed > 0 && ` · ${summary.failed} failed`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {summary.completed > 0 && (
                        <button
                          onClick={() => handleDownloadAll(batchId, batch.title)}
                          disabled={downloadingZip === batchId}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                        >
                          {downloadingZip === batchId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>Download All</span>
                        </button>
                      )}

                      <button
                        onClick={() => toggleExpand(batchId)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Tasks List */}
                  {isExpanded && (
                    <div className="space-y-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                      {bTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-2.5 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                {task.label}
                              </span>
                              {task.inputSize && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({formatBytes(task.inputSize)})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {task.status === "running" && (
                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                  {Math.round(task.progress * 100)}%
                                </span>
                              )}
                              {task.status === "completed" && (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Done
                                </span>
                              )}
                              {task.status === "failed" && (
                                <button
                                  onClick={() => retry(task.id)}
                                  className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" /> Retry
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Progress Bar */}
                          {task.status === "running" && (
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-blue-600 h-full transition-all duration-150"
                                style={{ width: `${Math.round(task.progress * 100)}%` }}
                              />
                            </div>
                          )}

                          {/* Stage details or error text */}
                          {task.stage && task.status === "running" && (
                            <div className="text-[10px] text-slate-400 truncate">{task.stage}</div>
                          )}
                          {task.error && (
                            <div className="text-[11px] text-rose-500 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-900/60 leading-tight">
                              {task.error}
                            </div>
                          )}

                          {/* Outputs */}
                          {task.outputs.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {task.outputs.map((out, i) => (
                                <a
                                  key={i}
                                  href={out.url}
                                  download={out.name}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors font-medium text-[11px]"
                                >
                                  <Download className="w-3 h-3 text-emerald-600" />
                                  <span className="truncate max-w-[200px]">{out.name}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
