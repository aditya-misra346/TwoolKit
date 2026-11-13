"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getPdfJs, PDFJS_ASSET_OPTS } from "@/lib/pdfClient";
import { triggerBlobDownload } from "@/lib/fileTypes";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Search,
  Download,
  Copy,
  Check,
  RotateCw,
  FileText,
  X,
} from "lucide-react";

interface PdfViewerStudioProps {
  file: File;
  onChangeFile: () => void;
}

interface SearchMatch {
  page: number;
  snippet: string;
}

export function PdfViewerStudio({ file, onChangeFile }: PdfViewerStudioProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.25);
  const [rotationOffset, setRotationOffset] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedPage, setCopiedPage] = useState(false);

  const matches = useMemo<SearchMatch[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const found: SearchMatch[] = [];
    pageTexts.forEach((txt, idx) => {
      const pos = txt.toLowerCase().indexOf(q);
      if (pos !== -1) {
        const start = Math.max(0, pos - 28);
        const end = Math.min(txt.length, pos + q.length + 48);
        found.push({ page: idx + 1, snippet: txt.slice(start, end) });
      }
    });
    return found;
  }, [searchQuery, pageTexts]);

  const pdfDocRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setNumPages(0);
    setCurrentPage(1);
    setPageTexts([]);

    (async () => {
      try {
        const pdfjs = await getPdfJs();
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = await pdfjs.getDocument({ data: bytes, ...PDFJS_ASSET_OPTS }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);

        // Extract text per page in background for instant search & copy
        const extracted: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const p = await doc.getPage(i);
          const tc = await p.getTextContent();
          extracted.push((tc.items as any[]).map((it) => it.str || "").join(" ").replace(/\s+/g, " ").trim());
        }
        if (!cancelled) setPageTexts(extracted);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load PDF document.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || numPages === 0) return;

    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        if (renderTaskRef.current?.cancel) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
        }
        const page = await doc.getPage(currentPage);
        if (cancelled) return;
        const viewport = page.getViewport({
          scale: zoom,
          rotation: (page.rotate + rotationOffset) % 360,
        });
        const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
        canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        const task = (page.render as any)({ canvas, canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (e: any) {
        if (!cancelled && e?.name !== "RenderingCancelledException") {
          setError(e?.message || "Failed to render PDF page.");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [numPages, currentPage, zoom, rotationOffset, file]);

  const handleCopyText = async () => {
    const txt = pageTexts[currentPage - 1] || "";
    if (!txt) return;
    await navigator.clipboard.writeText(txt).catch(() => {});
    setCopiedPage(true);
    setTimeout(() => setCopiedPage(false), 1800);
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold text-white truncate max-w-[180px] sm:max-w-[260px]">
            {file.name}
          </span>
          <button
            type="button"
            onClick={onChangeFile}
            className="text-xs px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            Change
          </button>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-300 px-2">
            Page{" "}
            <input
              type="number"
              min={1}
              max={Math.max(1, numPages)}
              value={currentPage}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n) && numPages > 0) {
                  setCurrentPage(Math.max(1, Math.min(numPages, n)));
                }
              }}
              className="w-12 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-center text-white"
            />{" "}
            / {numPages || "—"}
          </span>
          <button
            type="button"
            disabled={numPages === 0 || currentPage >= numPages}
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            className="p-1.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom + Rotate + Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))))}
            className="p-1.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-300 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.2).toFixed(2))))}
            className="p-1.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setRotationOffset((r) => (r + 90) % 360)}
            className="p-1.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 cursor-pointer"
            title="Rotate view 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleCopyText}
            disabled={!pageTexts[currentPage - 1]}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
          >
            {copiedPage ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedPage ? "Copied" : "Copy Text"}</span>
          </button>
          <button
            type="button"
            onClick={() => triggerBlobDownload(file, file.name)}
            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-2.5 flex flex-wrap items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 ml-1 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search text inside document..."
          className="flex-1 min-w-[200px] bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-hidden"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {searchQuery && (
          <span className="text-xs font-mono text-slate-400">
            {matches.length} {matches.length === 1 ? "page match" : "page matches"}
          </span>
        )}
      </div>

      {matches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {matches.slice(0, 12).map((m) => (
            <button
              key={m.page}
              type="button"
              onClick={() => setCurrentPage(m.page)}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
            >
              <strong className="text-blue-400">P.{m.page}</strong> · …{m.snippet}…
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Viewport */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 sm:p-6 overflow-auto max-h-[75vh] flex justify-center items-start relative">
        {rendering && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700 text-[11px] text-slate-300">
            Rendering page {currentPage}...
          </div>
        )}
        <canvas ref={canvasRef} className="shadow-2xl rounded-xs bg-white max-w-full h-auto" />
      </div>
    </div>
  );
}
