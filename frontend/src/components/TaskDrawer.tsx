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
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
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
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Clear completed batches"
              >
                Clear Done
              </button>
            )}
            <button
              onClick={() => setDrawer(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Batches Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {batchOrder.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500 space-y-3">
              <Clock className="w-10 h-10 stroke-1" />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Queue is empty
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Start an operation in any tool to monitor its progress here.
                </p>
              </div>
            </div>
          ) : (
            batchOrder.map((batchId) => {
              const batch = batches[batchId];
              if (!batch) return null;
              const bTasks = batchTasks({ tasks, order } as any, batchId);
              const summary = batchSummary(bTasks);
              const isExpanded = expandedBatches[batchId] ?? true;

              return (
                <div
                  key={batchId}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden"
                >
                  {/* Batch Summary Bar */}
                  <div className="p-4 bg-white dark:bg-slate-900/70 border-b border-slate-200/80 dark:border-slate-800 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {batch.title}
                          </h3>
                          {batch.paused && (
                            <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                              Paused
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {summary.completed}/{summary.total} completed
                          {summary.failed > 0 && ` · ${summary.failed} failed`}
                          {summary.running > 0 && ` · ${summary.running} running`}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        {!summary.done && (
                          <>
                            {batch.paused ? (
                              <button
                                onClick={() => resume(batchId)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                title="Resume batch"
                              >
                                <Play className="w-4 h-4 fill-current" />
                              </button>
                            ) : (
                              <button
                                onClick={() => pause(batchId)}
                                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                title="Pause queue"
                              >
                                <Pause className="w-4 h-4 fill-current" />
                              </button>
                            )}
                            <button
                              onClick={() => cancelBatch(batchId)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium"
                              title="Cancel batch"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {summary.failed > 0 && (
                          <button
                            onClick={() => retryFailed(batchId)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            title="Retry failed tasks"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}

                        {summary.completed > 0 && (
                          <button
                            onClick={() => handleDownloadAll(batchId, batch.title)}
                            disabled={downloadingZip === batchId}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs"
                          >
                            {downloadingZip === batchId ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                            Download All
                          </button>
                        )}

                        <button
                          onClick={() => removeBatch(batchId)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          title="Remove batch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => toggleExpand(batchId)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={clsx(
                          "h-full transition-all duration-300",
                          summary.failed > 0 && summary.completed === 0 ? "bg-rose-500" : "bg-blue-600"
                        )}
                        style={{ width: `${Math.round(summary.progress * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Tasks List */}
                  {isExpanded && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {bTasks.map((t) => (
                        <div key={t.id} className="p-3 text-xs flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {t.status === "completed" && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              )}
                              {t.status === "failed" && (
                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                              )}
                              {t.status === "running" && (
                                <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                              )}
                              {t.status === "queued" && (
                                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              {t.status === "cancelled" && (
                                <X className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <span className="font-semibold text-slate-900 dark:text-white truncate">
                                {t.label}
                              </span>
                              {t.inputSize > 0 && (
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  ({formatBytes(t.inputSize)})
                                </span>
                              )}
                            </div>

                            {/* Task actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              {t.status === "running" && (
                                <button
                                  onClick={() => cancelTask(t.id)}
                                  className="text-slate-400 hover:text-rose-500"
                                  title="Cancel task"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {(t.status === "failed" || t.status === "cancelled") && (
                                <button
                                  onClick={() => retry(t.id)}
                                  className="text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" /> Retry
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Stage / Progress / Error */}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{t.stage}</span>
                            {t.progress !== null && t.status === "running" && (
                              <span>{Math.round(t.progress * 100)}%</span>
                            )}
                          </div>

                          {t.error && (
                            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-[11px] leading-tight">
                              {t.error}
                            </div>
                          )}

                          {/* Outputs */}
                          {t.outputs.length > 0 && (
                            <div className="pt-1 flex flex-wrap gap-2">
                              {t.outputs.map((out) => (
                                <a
                                  key={out.id}
                                  href={out.url}
                                  download={out.name}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors"
                                >
                                  <Download className="w-3 h-3" />
                                  <span className="truncate max-w-[180px]">{out.name}</span>
                                  <span className="text-[10px] text-emerald-600/70 font-normal">
                                    ({formatBytes(out.blob.size)})
                                  </span>
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
