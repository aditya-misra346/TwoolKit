"use client";
/**
 * Global store for file scanning, storage analysis, and in-app Recycle Bin.
 * Persists current scan snapshot and virtual trash to IndexedDB.
 */
import { create } from "zustand";
import { idb } from "@/lib/db";
import { summarizeScan, type ScanResult, type ScannedFile } from "@/lib/scanner";

export interface TrashItem {
  id: string;
  originalFile: ScannedFile;
  deletedAt: number;
  reason: string;
}

interface ScanStoreState {
  currentScan: ScanResult | null;
  isScanning: boolean;
  scanProgress: number; // 0..1
  currentScanStage: string;
  trash: TrashItem[];

  // Actions
  setScanResult: (files: ScannedFile[]) => Promise<void>;
  updateScanProgress: (progress: number, stage: string) => void;
  clearScan: () => Promise<void>;
  loadPersisted: () => Promise<void>;

  // File management
  renameFile: (fileId: string, newName: string) => void;
  moveToTrash: (fileIds: string[], reason?: string) => Promise<void>;
  restoreFromTrash: (trashIds: string[]) => Promise<void>;
  emptyTrash: () => Promise<void>;
}

export const useScanStore = create<ScanStoreState>()((set, get) => ({
  currentScan: null,
  isScanning: false,
  scanProgress: 0,
  currentScanStage: "",
  trash: [],

  loadPersisted: async () => {
    try {
      const [savedFiles, savedTrash] = await Promise.all([
        idb.get<ScannedFile[]>("kv", "last_scan_files"),
        idb.get<TrashItem[]>("kv", "virtual_trash"),
      ]);
      if (savedFiles && savedFiles.length > 0) {
        const result = summarizeScan(savedFiles);
        set({ currentScan: result });
      }
      if (savedTrash) {
        set({ trash: savedTrash });
      }
    } catch {
      // IndexedDB fallback
    }
  },

  setScanResult: async (files: ScannedFile[]) => {
    const summary = summarizeScan(files);
    set({ currentScan: summary, isScanning: false, scanProgress: 1, currentScanStage: "Complete" });
    // Persist files (omitting live Blob refs for serialization)
    const serializable = files.map(({ fileRef, ...rest }) => rest as ScannedFile);
    await idb.set("kv", "last_scan_files", serializable);
  },

  updateScanProgress: (progress: number, stage: string) => {
    set({ isScanning: true, scanProgress: progress, currentScanStage: stage });
  },

  clearScan: async () => {
    set({ currentScan: null, isScanning: false, scanProgress: 0, currentScanStage: "" });
    await idb.del("kv", "last_scan_files");
  },

  renameFile: (fileId: string, newName: string) => {
    const scan = get().currentScan;
    if (!scan) return;
    const updated = scan.files.map((f) => {
      if (f.id === fileId) {
        const newPath = f.path.includes("/")
          ? f.path.slice(0, f.path.lastIndexOf("/") + 1) + newName
          : newName;
        return { ...f, name: newName, path: newPath };
      }
      return f;
    });
    void get().setScanResult(updated);
  },

  moveToTrash: async (fileIds: string[], reason = "User cleanup") => {
    const scan = get().currentScan;
    if (!scan) return;
    const toDeleteSet = new Set(fileIds);
    const deletedFiles: ScannedFile[] = [];
    const remainingFiles: ScannedFile[] = [];

    for (const f of scan.files) {
      if (toDeleteSet.has(f.id)) {
        deletedFiles.push(f);
      } else {
        remainingFiles.push(f);
      }
    }

    const newTrashItems: TrashItem[] = deletedFiles.map((f) => ({
      id: `trash_${f.id}_${Date.now()}`,
      originalFile: f,
      deletedAt: Date.now(),
      reason,
    }));

    const updatedTrash = [...newTrashItems, ...get().trash];
    set({ trash: updatedTrash });
    await idb.set("kv", "virtual_trash", updatedTrash);
    await get().setScanResult(remainingFiles);
  },

  restoreFromTrash: async (trashIds: string[]) => {
    const idSet = new Set(trashIds);
    const restored: ScannedFile[] = [];
    const remainingTrash: TrashItem[] = [];

    for (const item of get().trash) {
      if (idSet.has(item.id)) {
        restored.push(item.originalFile);
      } else {
        remainingTrash.push(item);
      }
    }

    set({ trash: remainingTrash });
    await idb.set("kv", "virtual_trash", remainingTrash);

    const scan = get().currentScan;
    const currentFiles = scan ? scan.files : [];
    await get().setScanResult([...currentFiles, ...restored]);
  },

  emptyTrash: async () => {
    set({ trash: [] });
    await idb.set("kv", "virtual_trash", []);
  },
}));
