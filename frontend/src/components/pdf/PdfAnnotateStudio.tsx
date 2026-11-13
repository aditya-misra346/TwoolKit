"use client";

import { useEffect, useRef, useState } from "react";
import {
  applyPdfAnnotations,
  getPdfJs,
  PDFJS_ASSET_OPTS,
  type VisualAnnotationItem,
} from "@/lib/pdfClient";
import { baseName } from "@/lib/fileTypes";
import {
  PenTool,
  Type,
  Highlighter,
  Eraser,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Trash2,
  Download,
  Upload,
} from "lucide-react";
import clsx from "clsx";

interface PdfAnnotateStudioProps {
  file: File;
  initialMode?: "edit" | "sign";
  onChangeFile: () => void;
  onExported: (outName: string, blob: Blob) => void;
}

type ActiveTool = "sign" | "text" | "highlight" | "whiteout";

interface PlacedAnnotation extends VisualAnnotationItem {
  previewUrl?: string;
}

export function PdfAnnotateStudio({
  file,
  initialMode = "edit",
  onChangeFile,
  onExported,
}: PdfAnnotateStudioProps) {
  const [activeTool, setActiveTool] = useState<ActiveTool>(initialMode === "sign" ? "sign" : "text");
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [annotations, setAnnotations] = useState<PlacedAnnotation[]>([]);
  const [pageSizePx, setPageSizePx] = useState<{ w: number; h: number }>({ w: 612, h: 792 });
  const [textInput, setTextInput] = useState("Approved");
  const [textColor, setTextColor] = useState("#0f172a");
  const [fontSize, setFontSize] = useState(16);
  const [sigTab, setSigTab] = useState<"draw" | "type" | "upload">("draw");
  const [typedSig, setTypedSig] = useState("A. Misra");
  const [sigBlob, setSigBlob] = useState<Blob | null>(null);
  const [sigPreviewUrl, setSigPreviewUrl] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pdfDocRef = useRef<any>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setAnnotations([]);
    (async () => {
      try {
        const pdfjs = await getPdfJs();
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = await pdfjs.getDocument({ data: bytes, ...PDFJS_ASSET_OPTS }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setCurrentPage(1);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load PDF.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    const doc = pdfDocRef.current;
    const canvas = pageCanvasRef.current;
    if (!doc || !canvas || numPages === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await doc.getPage(currentPage);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, 720 / base.width);
        const vp = page.getViewport({ scale });
        canvas.width = Math.max(1, Math.floor(vp.width));
        canvas.height = Math.max(1, Math.floor(vp.height));
        setPageSizePx({ w: canvas.width, h: canvas.height });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await (page.render as any)({ canvas, canvasContext: ctx, viewport: vp }).promise;
      } catch {
        // ignore cancel
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [numPages, currentPage, file]);

  // Helper to capture drawn signature canvas as transparent PNG Blob
  const captureDrawnSignature = async () => {
    const sc = sigCanvasRef.current;
    if (!sc) return;
    const blob = await new Promise<Blob | null>((res) => sc.toBlob((b) => res(b), "image/png"));
    if (blob) {
      if (sigPreviewUrl) URL.revokeObjectURL(sigPreviewUrl);
      setSigBlob(blob);
      setSigPreviewUrl(URL.createObjectURL(blob));
    }
  };

  const renderTypedSignature = async (name: string): Promise<{ blob: Blob; url: string } | null> => {
    setTypedSig(name);
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 140;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "italic 54px Georgia, 'Times New Roman', serif";
    ctx.fillStyle = "#0f172a";
    ctx.textBaseline = "middle";
    ctx.fillText(name || "Signature", 24, 70);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"));
    if (blob) {
      if (sigPreviewUrl) URL.revokeObjectURL(sigPreviewUrl);
      const url = URL.createObjectURL(blob);
      setSigBlob(blob);
      setSigPreviewUrl(url);
      return { blob, url };
    }
    return null;
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sc = sigCanvasRef.current;
    if (!sc) return;
    const rect = sc.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * sc.width;
    const y = ((e.clientY - rect.top) / rect.height) * sc.height;
    const ctx = sc.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const sc = sigCanvasRef.current;
    if (!sc) return;
    const rect = sc.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * sc.width;
    const y = ((e.clientY - rect.top) / rect.height) * sc.height;
    const ctx = sc.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleCanvasPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    void captureDrawnSignature();
  };

  const clearSignaturePad = () => {
    const sc = sigCanvasRef.current;
    if (sc) {
      const ctx = sc.getContext("2d");
      ctx?.clearRect(0, 0, sc.width, sc.height);
    }
    if (sigPreviewUrl) URL.revokeObjectURL(sigPreviewUrl);
    setSigBlob(null);
    setSigPreviewUrl("");
  };

  const handlePageClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = Math.max(0, Math.min(0.95, (e.clientX - rect.left) / rect.width));
    const yRatio = Math.max(0, Math.min(0.95, (e.clientY - rect.top) / rect.height));
    const pageIndex = currentPage - 1;

    if (activeTool === "sign") {
      let activeSig = sigBlob;
      let activeUrl = sigPreviewUrl;
      if (!activeSig && sigTab === "type") {
        const rendered = await renderTypedSignature(typedSig);
        if (rendered) {
          activeSig = rendered.blob;
          activeUrl = rendered.url;
        }
      }
      if (!activeSig) {
        setError("Draw, type, or upload a signature first, then click on the page to place it.");
        return;
      }
      setError(null);
      const itemPreview = activeUrl || URL.createObjectURL(activeSig);
      setAnnotations((prev) => [
        ...prev,
        {
          id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: "image",
          pageIndex,
          xRatio: Math.max(0, Math.min(0.74, xRatio - 0.13)),
          yRatio: Math.max(0, Math.min(0.9, yRatio - 0.04)),
          wRatio: 0.26,
          hRatio: 0.08,
          imageBlob: activeSig,
          previewUrl: itemPreview,
        },
      ]);
      return;
    }

    if (activeTool === "text") {
      if (!textInput.trim()) return;
      setAnnotations((prev) => [
        ...prev,
        {
          id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: "text",
          pageIndex,
          xRatio,
          yRatio,
          text: textInput,
          fontSize,
          colorHex: textColor,
        },
      ]);
      return;
    }

    if (activeTool === "highlight" || activeTool === "whiteout") {
      setAnnotations((prev) => [
        ...prev,
        {
          id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: activeTool,
          pageIndex,
          xRatio: Math.max(0, Math.min(0.75, xRatio)),
          yRatio: Math.max(0, Math.min(0.94, yRatio)),
          wRatio: 0.24,
          hRatio: 0.04,
          colorHex: activeTool === "highlight" ? "#facc15" : "#ffffff",
          opacity: activeTool === "highlight" ? 0.38 : 1,
        },
      ]);
    }
  };

  const handleApplyAndExport = async () => {
    if (annotations.length === 0) {
      setError("Click anywhere on the page preview to place at least one signature or annotation.");
      return;
    }
    setError(null);
    setIsExporting(true);
    try {
      const outBlob = await applyPdfAnnotations(file, annotations);
      onExported(`${baseName(file.name)}-annotated.pdf`, outBlob);
    } catch (e: any) {
      setError(e?.message || "Failed to apply annotations.");
    } finally {
      setIsExporting(false);
    }
  };

  const pageAnnotations = annotations.filter((a) => a.pageIndex === currentPage - 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Tool Controls */}
      <div className="lg:col-span-4 rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Annotate &amp; Sign Studio
          </span>
          <button
            type="button"
            onClick={onChangeFile}
            className="text-xs text-slate-400 hover:text-red-400 cursor-pointer"
          >
            Change PDF
          </button>
        </div>

        {/* Mode Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "sign", label: "Signature", icon: PenTool },
            { id: "text", label: "Text Note", icon: Type },
            { id: "highlight", label: "Highlight", icon: Highlighter },
            { id: "whiteout", label: "Whiteout", icon: Eraser },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTool(t.id as ActiveTool)}
                className={clsx(
                  "p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer",
                  activeTool === t.id
                    ? "border-blue-500 bg-blue-950/60 text-blue-200"
                    : "border-slate-800 text-slate-400 hover:text-slate-200"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Signature Creator */}
        {activeTool === "sign" && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex gap-1.5">
              {(["draw", "type", "upload"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setSigTab(tab);
                    if (tab === "type" && !sigBlob) {
                      void renderTypedSignature(typedSig);
                    }
                  }}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer",
                    sigTab === tab ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {sigTab === "draw" && (
              <div className="space-y-2">
                <canvas
                  ref={sigCanvasRef}
                  width={360}
                  height={110}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerLeave={handleCanvasPointerUp}
                  className="w-full h-28 bg-white rounded-xl border border-slate-700 touch-none cursor-crosshair"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Draw above, then click on page</span>
                  <button
                    type="button"
                    onClick={clearSignaturePad}
                    className="text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {sigTab === "type" && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={typedSig}
                  onChange={(e) => void renderTypedSignature(e.target.value)}
                  placeholder="Type your signature..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white"
                />
                {sigPreviewUrl && (
                  <div className="p-2 bg-white rounded-xl flex justify-center">
                    <img src={sigPreviewUrl} alt="Typed signature preview" className="h-12 object-contain" />
                  </div>
                )}
              </div>
            )}

            {sigTab === "upload" && (
              <label className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border border-dashed border-slate-700 bg-slate-800/40 cursor-pointer text-xs text-slate-300">
                <Upload className="w-4 h-4 text-blue-400" />
                <span>Choose PNG / JPG signature image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (sigPreviewUrl) URL.revokeObjectURL(sigPreviewUrl);
                      setSigBlob(f);
                      setSigPreviewUrl(URL.createObjectURL(f));
                    }
                  }}
                />
              </label>
            )}
          </div>
        )}

        {/* Text Controls */}
        {activeTool === "text" && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Text Label</label>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-slate-300">
                Size: {fontSize}pt
                <input
                  type="range"
                  min={10}
                  max={36}
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  className="w-full mt-1"
                />
              </label>
              <div className="flex items-center gap-1.5">
                {["#0f172a", "#1d4ed8", "#dc2626", "#15803d"].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setTextColor(hex)}
                    style={{ backgroundColor: hex }}
                    className={clsx(
                      "w-5 h-5 rounded-full border-2 cursor-pointer",
                      textColor === hex ? "border-white scale-110" : "border-slate-600"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {(activeTool === "highlight" || activeTool === "whiteout") && (
          <p className="text-xs text-slate-400 pt-2 border-t border-slate-800">
            Click directly on the page preview to stamp a {activeTool === "highlight" ? "yellow highlight" : "white redaction/whiteout"} bar.
          </p>
        )}

        {error && (
          <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* History + Save */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={annotations.length === 0}
              onClick={() => setAnnotations((prev) => prev.slice(0, -1))}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              disabled={annotations.length === 0}
              onClick={() => setAnnotations([])}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-red-300 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
          <span className="text-slate-400">{annotations.length} placed</span>
        </div>

        <button
          type="button"
          disabled={isExporting || annotations.length === 0}
          onClick={() => void handleApplyAndExport()}
          className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{isExporting ? "Saving PDF..." : "Apply & Save PDF"}</span>
        </button>
      </div>

      {/* Right Interactive Canvas */}
      <div className="lg:col-span-8 rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300">
            Click on the page below to place your <strong>{activeTool}</strong>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-300 px-2">
              {currentPage} / {numPages || "—"}
            </span>
            <button
              type="button"
              disabled={numPages === 0 || currentPage >= numPages}
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-auto max-h-[72vh] rounded-xl bg-slate-950 p-4 flex justify-center">
          <div
            onClick={(e) => void handlePageClick(e)}
            style={{ width: pageSizePx.w, height: pageSizePx.h }}
            className="relative shadow-xl cursor-crosshair shrink-0 select-none bg-white"
          >
            <canvas ref={pageCanvasRef} className="block w-full h-full" />
            {pageAnnotations.map((a) => (
              <div
                key={a.id}
                style={{
                  left: `${a.xRatio * 100}%`,
                  top: `${a.yRatio * 100}%`,
                  width: a.wRatio ? `${a.wRatio * 100}%` : undefined,
                  height: a.hRatio ? `${a.hRatio * 100}%` : undefined,
                }}
                className="absolute pointer-events-none"
              >
                {a.kind === "text" && (
                  <span
                    style={{ color: a.colorHex || "#0f172a", fontSize: `${a.fontSize || 16}px` }}
                    className="font-bold whitespace-nowrap drop-shadow-xs"
                  >
                    {a.text}
                  </span>
                )}
                {a.kind === "highlight" && (
                  <div className="w-full h-full bg-yellow-400/40 rounded-xs" />
                )}
                {a.kind === "whiteout" && (
                  <div className="w-full h-full bg-white border border-slate-300/60" />
                )}
                {a.kind === "image" && a.previewUrl && (
                  <img
                    src={a.previewUrl}
                    alt="Placed signature"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
