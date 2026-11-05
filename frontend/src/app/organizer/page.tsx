"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  Cpu,
} from "lucide-react";
import clsx from "clsx";

function OrganizerContent() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab") || searchParams.get("mode");
  const initialMode: "rename" | "categorize" | "archive" | "extract" =
    requested === "archive" || requested === "extract" || requested === "categorize" ? requested : "rename";

  const [files, setFiles] = useState<StagedFile[]>([]);
  const [mode, setMode] = useState<"rename" | "categorize" | "archive" | "extract">(initialMode);

  // Rename settings
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [addCounter, setAddCounter] = useState(false);
  const [caseTransform, setCaseTransform] = useState<"none" | "lower" | "upper">("none");

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
      enqueue(
        { title: "Organize Files into Folders", tool: "organizer", kind: "organize", statKind: "organize" },
        [
          {
            label: `Organized Collection (${files.length} files)`,
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
                outputs: [{ name: "categorized-files.zip", blob: zipBlob, note: "Organized into folder hierarchy" }],
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
            label: `ZIP Archive (${files.length} files)`,
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
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <FolderTree className="w-7 h-7 text-indigo-600 dark:text-indigo-400 shrink-0" />
          File Organizer & Batch Rule Studio
        </h1>
        <p className="text-sm sm:text-base text-slate-500 dark:text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
          Batch rename with live previews, group files by category folders, and safely create or extract ZIP archives with Zip-Slip protection.
        </p>
      </div>

      {/* Mode Selector Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          { id: "rename", label: "Batch Rename", icon: Edit3, desc: "Prefix, suffix, numbering, find & replace" },
          { id: "categorize", label: "Auto-Sort Folders", icon: FolderPlus, desc: "Group into Documents, Images, etc." },
          { id: "archive", label: "Create ZIP", icon: Archive, desc: "Pack files into compressed archive" },
          { id: "extract", label: "Safe ZIP Extract", icon: FileCheck, desc: "Extract with traversal protection" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id as any)}
              className={clsx(
                "p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                mode === item.id
                  ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 font-bold shadow-2xs"
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
              )}
            >
              <div>
                <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-2" />
                <div className="text-sm font-bold">{item.label}</div>
              </div>
              <div className="text-xs text-slate-400 mt-1.5 leading-snug line-clamp-2">
                {item.desc}
              </div>
            </button>
          );
        })}
      </div>

      {files.length === 0 ? (
        <DropZone
          onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
          selectedFiles={files}
          onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
          onClearAll={() => setFiles([])}
          accept={mode === "extract" ? ".zip" : undefined}
          title={mode === "extract" ? "Drop ZIP archive to safely extract" : "Drop files to organize or batch rename"}
          description="Supports single files, multiple files, folders, or ZIP archives"
          showToolRecommendations={false}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Staged files deck */}
          <div className="lg:col-span-5 space-y-3">
            <DropZone
              onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
              selectedFiles={files}
              onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
              onClearAll={() => setFiles([])}
              accept={mode === "extract" ? ".zip" : undefined}
              showToolRecommendations={false}
            />
          </div>

          {/* Rules & Configuration Panel */}
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs p-5 sm:p-6 space-y-5">
            {mode === "rename" && (
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                  Renaming Configuration Rules
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1 font-medium">
                      Add Prefix:
                    </label>
                    <input
                      type="text"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      placeholder="e.g. 2026_Report_"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1 font-medium">
                      Add Suffix:
                    </label>
                    <input
                      type="text"
                      value={suffix}
                      onChange={(e) => setSuffix(e.target.value)}
                      placeholder="e.g. _FINAL"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1 font-medium">
                      Find Pattern:
                    </label>
                    <input
                      type="text"
                      value={findText}
                      onChange={(e) => setFindText(e.target.value)}
                      placeholder="Text to replace"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1 font-medium">
                      Replace With:
                    </label>
                    <input
                      type="text"
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      placeholder="Replacement text"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={addCounter}
                      onChange={(e) => setAddCounter(e.target.checked)}
                      className="accent-indigo-600 w-3.5 h-3.5"
                    />
                    <span>Add Sequence Counter (_001, _002)</span>
                  </label>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[10px] text-slate-400">Case:</span>
                    {(["none", "lower", "upper"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCaseTransform(c)}
                        className={clsx(
                          "px-2 py-0.5 rounded text-[10px] font-semibold uppercase cursor-pointer",
                          caseTransform === c
                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Preview Table */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2.5">
                    Live Renaming Preview (First 5)
                  </span>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {files.slice(0, 5).map((f, idx) => {
                      const newName = handleComputeNewName(f.name, idx);
                      return (
                        <div
                          key={f.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs flex items-center justify-between gap-3"
                        >
                          <span
                            className="text-slate-400 truncate line-through max-w-[45%] text-xs"
                            title={f.name}
                          >
                            {f.name}
                          </span>
                          <span
                            className="font-semibold text-indigo-600 dark:text-indigo-400 truncate max-w-[50%] font-mono text-xs"
                            title={newName}
                          >
                            {newName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {mode === "categorize" && (
              <div className="space-y-2 text-xs">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                  Category Folder Sorting
                </span>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                  Files will be automatically sorted into top-level folders by category (<em>Documents</em>, <em>Images</em>, <em>Presentations</em>, <em>Spreadsheets</em>, <em>Archives</em>) and packed into a structured ZIP archive.
                </p>
              </div>
            )}

            {mode === "archive" && (
              <div className="space-y-2 text-xs">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                  ZIP Archive Packaging
                </span>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                  All staged files will be compressed via browser-native Deflate into a standard <code>.zip</code> file.
                </p>
              </div>
            )}

            {mode === "extract" && (
              <div className="space-y-2 text-xs">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                  Safe In-Browser Extraction
                </span>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                  ZIP files will be unpacked with full Zip-Slip path sanitization, preventing relative directory traversal attacks.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">
                100% Client-Side In-Browser Execution
              </div>
              <button
                onClick={handleRunOrganization}
                className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute {mode.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FileOrganizerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading Organizer...</div>}>
      <OrganizerContent />
    </Suspense>
  );
}
