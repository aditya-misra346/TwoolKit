"use client";

import { useState } from "react";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { useQueue } from "@/stores/tasks";
import { createZip, extractZip, inspectZip, type ZipEntry } from "@/lib/archiveClient";
import { formatBytes, extOf, categoryOf, CATEGORY_LABEL } from "@/lib/fileTypes";
import {
  FolderTree,
  Archive,
  Edit3,
  Play,
  Download,
  CheckCircle2,
  FolderPlus,
  Hash,
  Type,
  FileCheck,
} from "lucide-react";
import clsx from "clsx";

export default function FileOrganizerPage() {
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [mode, setMode] = useState<"rename" | "categorize" | "archive" | "extract">("rename");

  // Rename settings
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [addCounter, setAddCounter] = useState(false);
  const [caseTransform, setCaseTransform] = useState<"none" | "lower" | "upper">("none");

  // Archive inspection
  const [zipEntries, setZipEntries] = useState<ZipEntry[]>([]);

  const { enqueue, setDrawer } = useQueue();

  const handleComputeNewName = (originalName: string, index: number) => {
    let base = originalName.slice(0, originalName.lastIndexOf(".")) || originalName;
    const ext = extOf(originalName);

    if (findText) {
      base = base.replaceAll(findText, replaceText);
    }
    if (caseTransform === "lower") base = base.toLowerCase();
    if (caseTransform === "upper") base = base.toUpperCase();

    const countPart = addCounter ? `_${String(index + 1).padStart(3, "0")}` : "";
    const newBase = `${prefix}${base}${countPart}${suffix}`;
    return ext ? `${newBase}.${ext}` : newBase;
  };

  const handleRunOrganization = async () => {
    if (files.length === 0) return;

    if (mode === "rename") {
      enqueue(
        { title: "Batch Rename Files", tool: "organizer", kind: "organize", statKind: "organize" },
        files.map((f, i) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async () => {
            const newName = handleComputeNewName(f.name, i);
            return {
              outputs: [{ name: newName, blob: f.file }],
            };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    if (mode === "categorize") {
      // Group files into category folders and pack into structured ZIP
      enqueue(
        { title: "Organize Files into Folders", tool: "organizer", kind: "organize", statKind: "organize" },
        [
          {
            label: `Organized (${files.length} files)`,
            engine: "local",
            run: async (ctx) => {
              const packedFiles = files.map((f) => {
                const cat = categoryOf(f.name);
                const catFolder = CATEGORY_LABEL[cat] || "Other";
                return {
                  name: f.name,
                  path: `${catFolder}/${f.name}`,
                  blob: f.file,
                };
              });

              const zipBlob = await createZip(packedFiles, "DEFLATE", (p, s) =>
                ctx.progress(p, s)
              );
              return {
                outputs: [{ name: "categorized-files.zip", blob: zipBlob, note: "Organized by category" }],
              };
            },
          },
        ]
      );
      setDrawer(true);
      return;
    }

    if (mode === "archive") {
      enqueue(
        { title: "Create ZIP Archive", tool: "archive", kind: "archive", statKind: "organize" },
        [
          {
            label: `Archive (${files.length} files)`,
            engine: "local",
            run: async (ctx) => {
              const zipBlob = await createZip(
                files.map((f) => ({ name: f.name, blob: f.file })),
                "DEFLATE",
                (p, s) => ctx.progress(p, s)
              );
              return {
                outputs: [{ name: "archive.zip", blob: zipBlob }],
              };
            },
          },
        ]
      );
      setDrawer(true);
      return;
    }

    if (mode === "extract") {
      // Extract uploaded ZIP archives
      enqueue(
        { title: "Safe ZIP Extraction", tool: "archive", kind: "archive", statKind: "organize" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async (ctx) => {
            const extracted = await extractZip(f.file, (p, s) => ctx.progress(p, s));
            return {
              outputs: extracted.map((e) => ({ name: e.name, blob: e.blob, note: e.path })),
            };
          },
        }))
      );
      setDrawer(true);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <FolderTree className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          File Organizer & Archive Studio
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Batch rename files, organize into folder hierarchies, and safely create or extract ZIP archives.
        </p>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: "rename", label: "Batch Rename", icon: Edit3, desc: "Prefix, suffix, numbering, find/replace" },
          { id: "categorize", label: "Auto-Sort Folders", icon: FolderPlus, desc: "Group into Documents, Images, etc." },
          { id: "archive", label: "Create ZIP", icon: Archive, desc: "Pack files into compressed archive" },
          { id: "extract", label: "Safe ZIP Extract", icon: FileCheck, desc: "Extract with path traversal protection" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id as any)}
              className={clsx(
                "p-4 rounded-2xl border text-left transition-all",
                mode === item.id
                  ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 font-bold shadow-xs"
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
              )}
            >
              <Icon className="w-5 h-5 text-indigo-600 mb-2" />
              <div className="text-xs font-bold">{item.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-tight">
                {item.desc}
              </div>
            </button>
          );
        })}
      </div>

      <DropZone
        onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
        selectedFiles={files}
        onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
        onClearAll={() => setFiles([])}
        accept={mode === "extract" ? ".zip" : undefined}
        title={mode === "extract" ? "Drop ZIP archive to extract" : "Drop files to organize or rename"}
        description="Select individual files, multiple files, or folders"
        showToolRecommendations={false}
      />

      {files.length > 0 && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          {/* Rename Controls */}
          {mode === "rename" && (
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                Batch Rename Rules
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Add Prefix:
                  </label>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="e.g. 2026_Report_"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Add Suffix:
                  </label>
                  <input
                    type="text"
                    value={suffix}
                    onChange={(e) => setSuffix(e.target.value)}
                    placeholder="e.g. _FINAL"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Find Text:
                  </label>
                  <input
                    type="text"
                    value={findText}
                    onChange={(e) => setFindText(e.target.value)}
                    placeholder="Text to replace"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Replace With:
                  </label>
                  <input
                    type="text"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="Replacement text"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addCounter}
                    onChange={(e) => setAddCounter(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded-sm"
                  />
                  <span>Add Sequential Counter (_001, _002)</span>
                </label>
              </div>

              {/* Live Preview */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Example Rename Preview
                </span>
                <div className="text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span className="line-through text-slate-400">{files[0].name}</span>
                  <span>→</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {handleComputeNewName(files[0].name, 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Categorize Note */}
          {mode === "categorize" && (
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p>
                Files will be analyzed and automatically organized into category directories:
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 font-mono text-[11px] space-y-1">
                <div>📁 Documents/ (Word, PDF, Text)</div>
                <div>📁 Spreadsheets/ (Excel, CSV)</div>
                <div>📁 Presentations/ (PowerPoint)</div>
                <div>📁 Images/ (Photos, WebP, PNG)</div>
                <div>📁 Other/</div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleRunOrganization}
              className="w-full py-3 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {mode === "rename"
                  ? `Rename ${files.length} File(s)`
                  : mode === "categorize"
                  ? `Sort ${files.length} Files into Categories`
                  : mode === "archive"
                  ? `Pack ${files.length} Files into ZIP`
                  : `Extract Archive`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
