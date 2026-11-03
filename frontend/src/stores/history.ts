"use client";
/**
 * Activity log, processing statistics and stored outputs.
 * All numbers shown on the dashboard come from here (or from the scan store),
 * i.e. from work the user actually performed in this browser.
 */
import { create } from "zustand";
import { idb } from "@/lib/db";
import { useSettings } from "@/stores/settings";

export type ActivityKind =
  | "scan"
  | "convert"
  | "compress"
  | "organize"
  | "pdf"
  | "ocr"
  | "storage"
  | "assistant"
  | "archive";

export interface Activity {
  id: string;
  ts: number;
  kind: ActivityKind;
  title: string;
  detail?: string;
  status: "success" | "failed" | "cancelled";
  tool?: string;
  engine?: "local" | "server";
  files?: number;
  bytesIn?: number;
  bytesOut?: number;
}

export interface OutputRecord {
  id: string;
  ts: number;
  name: string;
  size: number;
  mime: string;
  tool: string;
  op: string;
  sourceNames: string[];
  engine: "local" | "server";
  /** true when the blob is kept in IndexedDB and can be re-downloaded */
  stored: boolean;
}

export interface Stats {
  filesConverted: number;
  filesCompressed: number;
  bytesSavedByCompression: number;
  tasksCompleted: number;
  tasksFailed: number;
  pdfOperations: number;
  ocrPages: number;
  scansRun: number;
  filesOrganized: number;
  bytesProcessed: number;
}

const emptyStats: Stats = {
  filesConverted: 0,
  filesCompressed: 0,
  bytesSavedByCompression: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  pdfOperations: 0,
  ocrPages: 0,
  scansRun: 0,
  filesOrganized: 0,
  bytesProcessed: 0,
};

const MAX_ACTIVITIES = 400;
const MAX_OUTPUT_RECORDS = 500;

interface HistoryState {
  loaded: boolean;
  activities: Activity[];
  outputs: OutputRecord[];
  stats: Stats;
  load: () => Promise<void>;
  log: (a: Omit<Activity, "id" | "ts">) => void;
  bump: (patch: Partial<Stats>) => void;
  recordOutput: (blob: Blob, meta: Omit<OutputRecord, "id" | "ts" | "stored" | "size" | "mime"> & { mime?: string }) => Promise<OutputRecord>;
  getOutputBlob: (id: string) => Promise<Blob | undefined>;
  removeOutput: (id: string) => Promise<void>;
  clearOutputs: () => Promise<void>;
  clearActivities: () => Promise<void>;
  resetStats: () => Promise<void>;
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const useHistory = create<HistoryState>()((set, get) => ({
  loaded: false,
  activities: [],
  outputs: [],
  stats: emptyStats,

  load: async () => {
    if (get().loaded) return;
    const [activities, outputs, stats] = await Promise.all([
      idb.get<Activity[]>("kv", "activities"),
      idb.get<OutputRecord[]>("kv", "outputs"),
      idb.get<Stats>("kv", "stats"),
    ]);
    set({
      loaded: true,
      activities: activities ?? [],
      outputs: outputs ?? [],
      stats: { ...emptyStats, ...(stats ?? {}) },
    });
  },

  log: (a) => {
    const act: Activity = { ...a, id: uid(), ts: Date.now() };
    const activities = [act, ...get().activities].slice(0, MAX_ACTIVITIES);
    set({ activities });
    void idb.set("kv", "activities", activities);
  },

  bump: (patch) => {
    const s = { ...get().stats };
    for (const [k, v] of Object.entries(patch)) {
      const key = k as keyof Stats;
      s[key] = (s[key] ?? 0) + (v as number);
    }
    set({ stats: s });
    void idb.set("kv", "stats", s);
  },

  recordOutput: async (blob, meta) => {
    const settings = useSettings.getState();
    const rec: OutputRecord = {
      ...meta,
      id: uid(),
      ts: Date.now(),
      size: blob.size,
      mime: meta.mime ?? (blob.type || "application/octet-stream"),
      stored: false,
    };
    if (settings.keepOutputs) {
      // Enforce the storage cap: evict oldest stored blobs first.
      const cap = settings.maxOutputStorageMB * 1024 * 1024;
      if (blob.size <= cap) {
        let outputs = get().outputs;
        let used = outputs.filter((o) => o.stored).reduce((n, o) => n + o.size, 0);
        const evict: string[] = [];
        for (let i = outputs.length - 1; i >= 0 && used + blob.size > cap; i--) {
          if (outputs[i].stored) {
            used -= outputs[i].size;
            evict.push(outputs[i].id);
          }
        }
        for (const id of evict) await idb.del("blobs", id);
        outputs = outputs.map((o) => (evict.includes(o.id) ? { ...o, stored: false } : o));
        set({ outputs });
        try {
          await idb.set("blobs", rec.id, blob);
          rec.stored = true;
        } catch {
          rec.stored = false;
        }
      }
    }
    const outputs = [rec, ...get().outputs].slice(0, MAX_OUTPUT_RECORDS);
    // drop blobs of records that fell off the end
    const dropped = get().outputs.slice(MAX_OUTPUT_RECORDS - 1).filter((o) => o.stored);
    for (const d of dropped) void idb.del("blobs", d.id);
    set({ outputs });
    await idb.set("kv", "outputs", outputs);
    return rec;
  },

  getOutputBlob: (id) => idb.get<Blob>("blobs", id),

  removeOutput: async (id) => {
    await idb.del("blobs", id);
    const outputs = get().outputs.filter((o) => o.id !== id);
    set({ outputs });
    await idb.set("kv", "outputs", outputs);
  },

  clearOutputs: async () => {
    await idb.clear("blobs");
    set({ outputs: [] });
    await idb.set("kv", "outputs", []);
  },

  clearActivities: async () => {
    set({ activities: [] });
    await idb.set("kv", "activities", []);
  },

  resetStats: async () => {
    set({ stats: emptyStats });
    await idb.set("kv", "stats", emptyStats);
  },
}));
