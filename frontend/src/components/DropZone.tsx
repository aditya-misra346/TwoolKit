"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  formatBytes,
  extOf,
  categoryOf,
  CATEGORY_LABEL,
  type Category,
} from "@/lib/fileTypes";
import {
  UploadCloud,
  FolderUp,
  FileText,
  X,
  FileCode,
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Archive,
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

export interface StagedFile {
  id: string;
  name: string;
  size: number;
  file: File;
  path?: string;
  category: string;
  extension: string;
  thumbnailUrl?: string;
}

interface DropZoneProps {
  onFilesSelected: (files: StagedFile[]) => void;
  accept?: string;
  multiple?: boolean;
  allowFolder?: boolean;
  className?: string;
  title?: string;
  description?: string;
  selectedFiles?: StagedFile[];
  onRemoveFile?: (id: string) => void;
  onClearAll?: () => void;
  showToolRecommendations?: boolean;
}

export function DropZone({
  onFilesSelected,
  accept,
  multiple = true,
  allowFolder = true,
  className,
  title = "Drop files here or click to browse",
  description = "Supports documents, presentations, spreadsheets, images, or full folders",
  selectedFiles = [],
  onRemoveFile,
  onClearAll,
  showToolRecommendations = true,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // Generate thumbnails for image files
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    const urls: string[] = [];
    const newThumbs: Record<string, string> = {};

    for (const f of selectedFiles) {
      if (f.file.type.startsWith("image/") && !thumbnails[f.id]) {
        try {
          const url = URL.createObjectURL(f.file);
          urls.push(url);
          newThumbs[f.id] = url;
        } catch {
          // fallback
        }
      }
    }

    if (Object.keys(newThumbs).length > 0) {
      setThumbnails((prev) => ({ ...prev, ...newThumbs }));
    }

    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [selectedFiles]);

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      const staged: StagedFile[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const name = file.name;
        const size = file.size;
        const ext = extOf(name);
        const cat = categoryOf(name);
        const path = (file as any).webkitRelativePath || name;

        staged.push({
          id: `${name}_${size}_${file.lastModified}_${Math.random().toString(36).slice(2, 6)}`,
          name,
          size,
          file,
          path,
          category: cat,
          extension: ext,
        });
      }
      onFilesSelected(staged);
    },
    [onFilesSelected]
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleSelectFolder = async () => {
    if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const files: File[] = [];
        async function readDir(handle: any, curPath: string) {
          for await (const entry of handle.values()) {
            if (entry.kind === "file") {
              const file = await entry.getFile();
              Object.defineProperty(file, "webkitRelativePath", {
                value: `${curPath}/${entry.name}`,
                writable: true,
              });
              files.push(file);
            } else if (entry.kind === "directory") {
              await readDir(entry, `${curPath}/${entry.name}`);
            }
          }
        }
        await readDir(dirHandle, dirHandle.name);
        processFiles(files);
        return;
      } catch (err: any) {
        if (err.name === "AbortError") return;
      }
    }
    folderInputRef.current?.click();
  };

  const dominantExtension = selectedFiles.length > 0 ? selectedFiles[0].extension : "";
  const getRecommendations = () => {
    switch (dominantExtension) {
      case "pdf":
        return [
          { name: "Convert to Word (DOCX)", href: "/pdf/to-word" },
          { name: "Convert to PowerPoint (PPTX)", href: "/pdf/to-pptx" },
          { name: "Compress PDF", href: "/pdf/compress" },
          { name: "Merge PDFs", href: "/pdf/merge" },
          { name: "OCR PDF", href: "/pdf/ocr" },
        ];
      case "pptx":
      case "ppt":
        return [
          { name: "Convert to PDF", href: "/documents/presentations" },
          { name: "Extract Slide Images", href: "/documents/presentations" },
          { name: "Render Slides to Video", href: "/documents/presentations" },
        ];
      case "docx":
      case "doc":
        return [
          { name: "Convert to PDF", href: "/documents" },
          { name: "Convert to ODT / TXT", href: "/documents" },
        ];
      case "xlsx":
      case "xls":
      case "csv":
        return [
          { name: "Convert to CSV / TSV", href: "/documents?family=spreadsheet" },
          { name: "Export to JSON / XML", href: "/documents?family=spreadsheet" },
        ];
      case "png":
      case "jpg":
      case "jpeg":
      case "webp":
      case "heic":
        return [
          { name: "Convert to WebP / AVIF", href: "/images" },
          { name: "Compress & Optimize", href: "/images?tool=compress" },
          { name: "Resize & Edit", href: "/images?tool=edit" },
          { name: "Convert to PDF", href: "/pdf/images-to-pdf" },
        ];
      default:
        return [
          { name: "Analyze in Scanner", href: "/scanner" },
          { name: "Compress into ZIP", href: "/organizer?tab=archive" },
          { name: "Check Duplicates", href: "/scanner?tab=duplicates" },
        ];
    }
  };

  const renderFileIcon = (file: StagedFile) => {
    if (thumbnails[file.id]) {
      return (
        <img
          src={thumbnails[file.id]}
          alt={file.name}
          className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0"
        />
      );
    }

    const cat = file.category;
    let iconClass = "bg-blue-950 text-blue-300 border border-blue-800/60";
    if (cat === "pdf") iconClass = "bg-red-950 text-red-300 border border-red-800/60";
    else if (cat === "image") iconClass = "bg-emerald-950 text-emerald-300 border border-emerald-800/60";
    else if (cat === "presentation") iconClass = "bg-orange-950 text-orange-300 border border-orange-800/60";
    else if (cat === "spreadsheet") iconClass = "bg-green-950 text-green-300 border border-green-800/60";
    else if (cat === "archive") iconClass = "bg-pink-950 text-pink-300 border border-pink-800/60";

    return (
      <div
        className={clsx(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-2xs uppercase tracking-wider",
          iconClass
        )}
      >
        {file.extension.slice(0, 4) || "FILE"}
      </div>
    );
  };

  // State 1: Files Already Uploaded -> Sleek Workspace View
  if (selectedFiles.length > 0) {
    const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

    return (
      <div className={clsx("w-full space-y-3.5", className)}>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                Staged Files ({selectedFiles.length})
              </span>
              <span className="text-xs sm:text-sm text-slate-300 font-mono">· {formatBytes(totalSize)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => addMoreInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add More</span>
              </button>
              {onClearAll && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/50 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Staged Files List */}
          <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
            {selectedFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/55 border border-slate-700/70 text-sm hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {renderFileIcon(f)}
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-semibold text-slate-100 text-sm sm:text-[15.5px] truncate"
                      title={f.path || f.name}
                    >
                      {f.path || f.name}
                    </div>
                    <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="font-mono font-medium">{formatBytes(f.size)}</span>
                      <span>·</span>
                      <span className="capitalize font-medium">{CATEGORY_LABEL[f.category as Category] ?? f.category}</span>
                      {f.extension && (
                        <>
                          <span>·</span>
                          <span className="uppercase font-mono text-2xs px-1.5 py-0.5 rounded bg-slate-900 text-blue-300 border border-slate-700">
                            .{f.extension}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {onRemoveFile && (
                  <button
                    type="button"
                    onClick={() => onRemoveFile(f.id)}
                    className="p-2 text-slate-300 hover:text-rose-400 rounded-xl hover:bg-slate-700/80 transition-colors cursor-pointer shrink-0"
                    title="Remove file"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Compact Drop Zone to Append More Files */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => addMoreInputRef.current?.click()}
            className={clsx(
              "py-3.5 px-4 rounded-xl border border-dashed text-center text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2.5",
              isDragOver
                ? "border-blue-500 bg-blue-950/40 text-blue-300"
                : "border-slate-700 text-slate-300 hover:border-blue-400 hover:bg-slate-800/50"
            )}
          >
            <UploadCloud className="w-4 h-4 shrink-0" />
            <span>Drop additional files here to append</span>
          </div>

          {/* Recommended Actions */}
          {showToolRecommendations && (
            <div className="pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-blue-400 mb-2.5">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Suggested workflows for these files:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {getRecommendations().map((rec, i) => (
                  <Link
                    key={i}
                    href={rec.href}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-950/60 text-blue-200 border border-blue-800/70 hover:bg-blue-900/50 transition-colors"
                  >
                    <span>{rec.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hidden inputs */}
        <input
          ref={addMoreInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => e.target.files && processFiles(e.target.files)}
          className="hidden"
        />
      </div>
    );
  }

  // State 2: Empty Initial Upload Zone
  return (
    <div className={clsx("w-full space-y-4", className)}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          "relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center gap-4 group",
          isDragOver
            ? "border-blue-500 bg-blue-950/40 scale-[1.005]"
            : "border-slate-800 bg-slate-900/60 hover:border-blue-500 hover:bg-slate-800/45 shadow-xs"
        )}
      >
        <div className="w-16 h-16 rounded-2xl bg-blue-950/80 text-blue-400 border border-blue-900/60 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
          <UploadCloud className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {title}
          </h3>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            {description}
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer"
          >
            Select Files
          </button>
          {allowFolder && (
            <button
              type="button"
              onClick={handleSelectFolder}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              <FolderUp className="w-4 h-4 text-slate-400" />
              <span>Upload Folder</span>
            </button>
          )}
        </div>

        {/* Supported Format Pills */}
        <div className="flex flex-wrap justify-center items-center gap-2 pt-2 text-2xs font-semibold text-slate-300">
          <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/70 font-mono">PDF</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/70 font-mono">DOCX / DOC</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/70 font-mono">PPTX / PPT</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/70 font-mono">XLSX / CSV</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/70 font-mono">JPG / PNG / WebP</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/70 font-mono">ZIP</span>
        </div>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => e.target.files && processFiles(e.target.files)}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          {...({ webkitdirectory: "", directory: "" } as any)}
          multiple
          onChange={(e) => e.target.files && processFiles(e.target.files)}
          className="hidden"
        />
      </div>
    </div>
  );
}
