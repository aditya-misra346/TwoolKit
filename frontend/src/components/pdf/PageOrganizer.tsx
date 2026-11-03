"use client";

import { useState, useEffect } from "react";
import {
  renderPdfThumbnails,
  organizePdfPages,
  type PageAction,
  type RenderedThumbnail,
} from "@/lib/pdfClient";
import {
  RotateCw,
  Trash2,
  Plus,
  ArrowLeft,
  ArrowRight,
  Copy,
  Undo2,
  Sparkles,
  FileText,
  Loader2,
  Check,
} from "lucide-react";
import clsx from "clsx";

export interface PageItem {
  id: string;
  sourceIndex: number; // -1 for blank page
  originalPageNumber: number;
  rotation: number; // 0, 90, 180, 270
  dataUrl?: string;
  isBlank?: boolean;
}

interface Props {
  file: File;
  onApply: (actions: PageAction[]) => void;
  isProcessing?: boolean;
}

export function PageOrganizer({ file, onApply, isProcessing }: Props) {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressMsg, setProgressMsg] = useState("Loading pages...");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const thumbs = await renderPdfThumbnails(file, 200, 100, (cur, total) => {
          if (!cancelled) setProgressMsg(`Rendering page ${cur} of ${total}`);
        });
        if (cancelled) return;
        const initialPages: PageItem[] = thumbs.map((t, idx) => ({
          id: `page-${idx}-${Date.now()}`,
          sourceIndex: t.pageIndex,
          originalPageNumber: t.pageNumber,
          rotation: 0,
          dataUrl: t.dataUrl,
        }));
        setPages(initialPages);
      } catch (err) {
        console.error("Failed to load PDF thumbnails:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const rotatePage = (id: string, delta = 90) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, rotation: (p.rotation + delta) % 360 } : p
      )
    );
  };

  const rotateAll = (delta = 90) => {
    setPages((prev) =>
      prev.map((p) => ({ ...p, rotation: (p.rotation + delta) % 360 }))
    );
  };

  const movePage = (index: number, direction: "left" | "right") => {
    const targetIdx = direction === "left" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= pages.length) return;
    setPages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(targetIdx, 0, item);
      return copy;
    });
  };

  const deletePage = (id: string) => {
    if (pages.length <= 1) return;
    setPages((prev) => prev.filter((p) => p.id !== id));
  };

  const duplicatePage = (index: number) => {
    setPages((prev) => {
      const copy = [...prev];
      const target = copy[index];
      const cloned: PageItem = {
        ...target,
        id: `dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      copy.splice(index + 1, 0, cloned);
      return copy;
    });
  };

  const insertBlankPage = (afterIndex?: number) => {
    const idx = afterIndex != null ? afterIndex : pages.length - 1;
    const blank: PageItem = {
      id: `blank-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sourceIndex: -1,
      originalPageNumber: 0,
      rotation: 0,
      isBlank: true,
    };
    setPages((prev) => {
      const copy = [...prev];
      copy.splice(idx + 1, 0, blank);
      return copy;
    });
  };

  const resetAll = async () => {
    setLoading(true);
    const thumbs = await renderPdfThumbnails(file, 200, 100);
    setPages(
      thumbs.map((t, idx) => ({
        id: `page-${idx}-${Date.now()}`,
        sourceIndex: t.pageIndex,
        originalPageNumber: t.pageNumber,
        rotation: 0,
        dataUrl: t.dataUrl,
      }))
    );
    setLoading(false);
  };

  const handleApply = () => {
    const actions: PageAction[] = pages.map((p) => ({
      sourceIndex: p.sourceIndex,
      rotationDelta: p.rotation,
    }));
    onApply(actions);
  };

  if (loading) {
    return (
      <div className="py-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
        <Loader2 className="w-8 h-8 mx-auto text-blue-500 animate-spin" />
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {progressMsg}
        </div>
        <p className="text-[11px] text-slate-400">
          Generating high-resolution page previews for visual organization
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => insertBlankPage()}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-blue-500" />
            <span>Insert Blank Page</span>
          </button>
          <button
            type="button"
            onClick={() => rotateAll(90)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Rotate All 90°</span>
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {pages.length} page{pages.length !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={handleApply}
            disabled={isProcessing || pages.length === 0}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {isProcessing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>Save Organized PDF</span>
          </button>
        </div>
      </div>

      {/* Pages Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {pages.map((page, index) => (
          <div
            key={page.id}
            onClick={() => setSelectedId(page.id)}
            className={clsx(
              "group relative rounded-xl border p-2 transition-all flex flex-col justify-between bg-slate-50 dark:bg-slate-900/60",
              selectedId === page.id
                ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
            )}
          >
            {/* Header info bar */}
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 px-0.5">
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[9px] font-mono">
                  {index + 1}
                </span>
                {page.isBlank ? (
                  <span className="text-[10px] text-blue-500 font-semibold">Blank</span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-normal">
                    (orig #{page.originalPageNumber})
                  </span>
                )}
              </span>

              {page.rotation > 0 && (
                <span className="text-[9px] text-amber-500 font-mono font-bold">
                  {page.rotation}°
                </span>
              )}
            </div>

            {/* Thumbnail Canvas / Image */}
            <div className="relative aspect-3/4 rounded-lg overflow-hidden bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center shadow-2xs">
              {page.isBlank ? (
                <div className="text-center p-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center mx-auto mb-1">
                    <Plus className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400">Blank Page</div>
                </div>
              ) : page.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={page.dataUrl}
                  alt={`Page ${index + 1}`}
                  className="max-h-full max-w-full object-contain transition-transform duration-200"
                  style={{ transform: `rotate(${page.rotation}deg)` }}
                />
              ) : (
                <div className="text-center">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-400 font-semibold">Page {page.originalPageNumber}</span>
                </div>
              )}
            </div>

            {/* Page Action Controls */}
            <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Move left"
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    movePage(index, "left");
                  }}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Move right"
                  disabled={index === pages.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    movePage(index, "right");
                  }}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Rotate 90°"
                  onClick={(e) => {
                    e.stopPropagation();
                    rotatePage(page.id, 90);
                  }}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Duplicate page"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicatePage(index);
                  }}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Delete page"
                  disabled={pages.length <= 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePage(page.id);
                  }}
                  className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 dark:hover:bg-red-950/40 disabled:opacity-30 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
