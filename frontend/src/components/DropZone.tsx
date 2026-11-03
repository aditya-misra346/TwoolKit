"use client";

import { useState, useRef, useCallback } from "react";
import { formatBytes, extOf, categoryOf, CATEGORY_LABEL, type Category } from "@/lib/fileTypes";
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
  description = "Supports individual files, multiple files, ZIP archives, or full folders",
  selectedFiles = [],
  onRemoveFile,
  onClearAll,
  showToolRecommendations = true,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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

  // Folder selection with File System Access API or webkitdirectory fallback
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
    // Fallback: trigger webkitdirectory input
    folderInputRef.current?.click();
  };

  // Recommendations based on staged files
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
          { name: "Convert Slides to Video", href: "/documents/presentations" },
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
          { name: "Convert Images to PDF", href: "/pdf/images-to-pdf" },
        ];
      default:
        return [
          { name: "Analyze in Scanner", href: "/scanner" },
          { name: "Compress into ZIP", href: "/organizer?tab=archive" },
          { name: "Check Duplicates", href: "/scanner?tab=duplicates" },
        ];
    }
  };

  return (
    <div className={clsx("w-full space-y-4", className)}>
      {/* Drop Zone Box */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          "relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center gap-4 group",
          isDragOver
            ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 scale-[1.005]"
            : "border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 shadow-xs"
        )}
      >
        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-md shadow-blue-500/10 group-hover:scale-110 transition-transform">
          <UploadCloud className="w-8 h-8" />
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
            {description}
          </p>
        </div>

        {/* Buttons inside DropZone */}
        <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors"
          >
            Select Files
          </button>
          {allowFolder && (
            <button
              type="button"
              onClick={handleSelectFolder}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors flex items-center gap-1.5"
            >
              <FolderUp className="w-3.5 h-3.5 text-slate-500" />
              Upload Folder
            </button>
          )}
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

      {/* Selected Files List & Recommendations */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Staged Files ({selectedFiles.length})
              </span>
              <span className="text-xs text-slate-400">
                · Total {formatBytes(selectedFiles.reduce((acc, f) => acc + f.size, 0))}
              </span>
            </div>
            {onClearAll && (
              <button
                onClick={onClearAll}
                className="text-xs text-slate-400 hover:text-rose-500 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Chips grid */}
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
            {selectedFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold text-[9px] uppercase">
                    {f.extension || "bin"}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-sm sm:max-w-md">
                      {f.path || f.name}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>{formatBytes(f.size)}</span>
                      <span>·</span>
                      <span className="capitalize">{CATEGORY_LABEL[f.category as Category] ?? f.category}</span>
                    </div>
                  </div>
                </div>
                {onRemoveFile && (
                  <button
                    onClick={() => onRemoveFile(f.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded-md transition-colors"
                    title="Remove file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Recommended Next Actions */}
          {showToolRecommendations && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Recommended actions for these files:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {getRecommendations().map((rec, i) => (
                  <Link
                    key={i}
                    href={rec.href}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    <span>{rec.name}</span>
                    <ArrowRight className="w-3 h-3 text-blue-500" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
