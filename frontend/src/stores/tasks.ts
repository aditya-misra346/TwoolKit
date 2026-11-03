"use client";
/**
 * Batch processing engine.
 *
 * Every operation in Vellum (local or server) runs as a Task in this queue.
 * The scheduler limits concurrency separately for in-browser work (CPU/memory
 * bound) and server jobs, supports per-batch pause/resume (stops dispatching
 * queued tasks; running tasks finish), cancel (aborts in-flight work), and
 * retry of failed/cancelled tasks. Progress is whatever the task reports —
 * a real fraction or `null` (indeterminate) — never a timer.
 */
import { create } from "zustand";
import { useSettings } from "@/stores/settings";
import { useHistory, uid, type ActivityKind } from "@/stores/history";
import { CancelledError } from "@/lib/api";

export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface TaskOutput {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  note?: string | null;
}

export interface TaskContext {
  signal: AbortSignal;
  progress: (p: number | null, stage?: string) => void;
}

export interface TaskResult {
  outputs: { name: string; blob: Blob; note?: string | null }[];
  warnings?: string[];
  /** extra numbers for dashboard stats */
  meta?: Record<string, number>;
}

export interface TaskSpec {
  label: string; // usually the filename
  inputSize?: number;
  engine: "local" | "server";
  run: (ctx: TaskContext) => Promise<TaskResult>;
}

export interface Task {
  id: string;
  batchId: string;
  label: string;
  inputSize: number;
  engine: "local" | "server";
  status: TaskStatus;
  progress: number | null;
  stage: string;
  error?: string;
  warnings: string[];
  outputs: TaskOutput[];
  queuedAt: number;
  startedAt?: number;
  finishedAt?: number;
  meta?: Record<string, number>;
}

export interface BatchInfo {
  id: string;
  title: string;
  tool: string;
  kind: ActivityKind;
  createdAt: number;
  paused: boolean;
  /** stats to bump per successful task */
  statKind?: "convert" | "compress" | "pdf" | "ocr" | "organize";
  logged?: boolean;
}

interface QueueState {
  tasks: Record<string, Task>;
  order: string[];
  batches: Record<string, BatchInfo>;
  batchOrder: string[];
  drawerOpen: boolean;
  setDrawer: (open: boolean) => void;
  enqueue: (batch: Omit<BatchInfo, "id" | "createdAt" | "paused">, specs: TaskSpec[]) => string;
  pause: (batchId: string) => void;
  resume: (batchId: string) => void;
  cancelBatch: (batchId: string) => void;
  cancelTask: (taskId: string) => void;
  retry: (taskId: string) => void;
  retryFailed: (batchId: string) => void;
  removeBatch: (batchId: string) => void;
  clearFinished: () => void;
}

const specs = new Map<string, TaskSpec>();
const controllers = new Map<string, AbortController>();

export const useQueue = create<QueueState>()((set, get) => {
  const patch = (id: string, p: Partial<Task>) =>
    set((s) => (s.tasks[id] ? { tasks: { ...s.tasks, [id]: { ...s.tasks[id], ...p } } } : s));

  const finishBatchIfDone = (batchId: string) => {
    const s = get();
    const b = s.batches[batchId];
    if (!b || b.logged) return;
    const ts = s.order.map((id) => s.tasks[id]).filter((t) => t && t.batchId === batchId);
    if (ts.some((t) => t.status === "queued" || t.status === "running")) return;
    const ok = ts.filter((t) => t.status === "completed");
    const failed = ts.filter((t) => t.status === "failed");
    const bytesIn = ok.reduce((n, t) => n + t.inputSize, 0);
    const bytesOut = ok.reduce((n, t) => n + t.outputs.reduce((m, o) => m + o.blob.size, 0), 0);
    set((st) => ({ batches: { ...st.batches, [batchId]: { ...b, logged: true } } }));
    useHistory.getState().log({
      kind: b.kind,
      title: b.title,
      detail:
        `${ok.length}/${ts.length} succeeded` +
        (failed.length ? ` · ${failed.length} failed` : "") +
        (ts.some((t) => t.status === "cancelled") ? " · some cancelled" : ""),
      status: ok.length === 0 ? (failed.length ? "failed" : "cancelled") : "success",
      tool: b.tool,
      engine: ts[0]?.engine,
      files: ts.length,
      bytesIn,
      bytesOut,
    });
  };

  const schedule = () => {
    const s = get();
    const settings = useSettings.getState();
    const running = { local: 0, server: 0 };
    for (const id of s.order) {
      const t = s.tasks[id];
      if (t?.status === "running") running[t.engine]++;
    }
    const limits = { local: Math.max(1, settings.localConcurrency), server: Math.max(1, settings.serverConcurrency) };
    for (const id of s.order) {
      const t = get().tasks[id];
      if (!t || t.status !== "queued") continue;
      if (get().batches[t.batchId]?.paused) continue;
      if (running[t.engine] >= limits[t.engine]) continue;
      running[t.engine]++;
      void start(id);
    }
  };

  const start = async (id: string) => {
    const spec = specs.get(id);
    if (!spec) return;
    const ctrl = new AbortController();
    controllers.set(id, ctrl);
    patch(id, { status: "running", startedAt: Date.now(), progress: 0, stage: "Starting", error: undefined });
    let lastPatch = 0;
    const ctx: TaskContext = {
      signal: ctrl.signal,
      progress: (p, stage) => {
        // throttle UI updates to ~15/s, but always pass through stage changes
        const now = performance.now();
        const cur = get().tasks[id];
        if (stage === cur?.stage && now - lastPatch < 66 && p !== 1) return;
        lastPatch = now;
        patch(id, { progress: p == null ? null : Math.max(0, Math.min(1, p)), ...(stage ? { stage } : {}) });
      },
    };
    try {
      const res = await spec.run(ctx);
      if (ctrl.signal.aborted) throw new CancelledError();
      const outputs: TaskOutput[] = res.outputs.map((o) => ({
        id: uid(),
        name: o.name,
        blob: o.blob,
        url: URL.createObjectURL(o.blob),
        note: o.note,
      }));
      patch(id, {
        status: "completed",
        progress: 1,
        stage: "Done",
        outputs,
        warnings: res.warnings ?? [],
        finishedAt: Date.now(),
        meta: res.meta,
      });
      // persist outputs + stats
      const task = get().tasks[id];
      const batch = get().batches[task.batchId];
      const hist = useHistory.getState();
      for (const o of outputs) {
        void hist.recordOutput(o.blob, {
          name: o.name,
          tool: batch?.tool ?? "unknown",
          op: batch?.title ?? "",
          sourceNames: [task.label],
          engine: task.engine,
        });
      }
      const outBytes = outputs.reduce((n, o) => n + o.blob.size, 0);
      const stat: Record<string, number> = { tasksCompleted: 1, bytesProcessed: task.inputSize };
      switch (batch?.statKind) {
        case "convert":
          stat.filesConverted = 1;
          break;
        case "compress":
          stat.filesCompressed = 1;
          stat.bytesSavedByCompression = Math.max(0, task.inputSize - outBytes);
          break;
        case "pdf":
          stat.pdfOperations = 1;
          break;
        case "ocr":
          stat.ocrPages = res.meta?.pages ?? 1;
          break;
        case "organize":
          stat.filesOrganized = res.meta?.files ?? 1;
          break;
      }
      hist.bump(stat);
    } catch (e) {
      const cancelled = e instanceof CancelledError || ctrl.signal.aborted || (e as Error)?.name === "AbortError";
      patch(id, {
        status: cancelled ? "cancelled" : "failed",
        stage: cancelled ? "Cancelled" : "Failed",
        error: cancelled ? undefined : humanError(e),
        finishedAt: Date.now(),
      });
      if (!cancelled) useHistory.getState().bump({ tasksFailed: 1 });
    } finally {
      controllers.delete(id);
      finishBatchIfDone(get().tasks[id]?.batchId);
      schedule();
    }
  };

  return {
    tasks: {},
    order: [],
    batches: {},
    batchOrder: [],
    drawerOpen: false,
    setDrawer: (open) => set({ drawerOpen: open }),

    enqueue: (batch, list) => {
      const batchId = uid();
      const tasks: Record<string, Task> = {};
      const ids: string[] = [];
      for (const spec of list) {
        const id = uid();
        specs.set(id, spec);
        ids.push(id);
        tasks[id] = {
          id,
          batchId,
          label: spec.label,
          inputSize: spec.inputSize ?? 0,
          engine: spec.engine,
          status: "queued",
          progress: 0,
          stage: "Queued",
          warnings: [],
          outputs: [],
          queuedAt: Date.now(),
        };
      }
      set((s) => ({
        tasks: { ...s.tasks, ...tasks },
        order: [...s.order, ...ids],
        batches: { ...s.batches, [batchId]: { ...batch, id: batchId, createdAt: Date.now(), paused: false } },
        batchOrder: [batchId, ...s.batchOrder],
      }));
      schedule();
      return batchId;
    },

    pause: (batchId) => {
      set((s) => ({ batches: { ...s.batches, [batchId]: { ...s.batches[batchId], paused: true } } }));
    },
    resume: (batchId) => {
      set((s) => ({ batches: { ...s.batches, [batchId]: { ...s.batches[batchId], paused: false } } }));
      schedule();
    },
    cancelBatch: (batchId) => {
      const s = get();
      for (const id of s.order) {
        const t = s.tasks[id];
        if (t.batchId !== batchId) continue;
        if (t.status === "queued") patch(id, { status: "cancelled", stage: "Cancelled", finishedAt: Date.now() });
        if (t.status === "running") controllers.get(id)?.abort();
      }
      finishBatchIfDone(batchId);
    },
    cancelTask: (taskId) => {
      const t = get().tasks[taskId];
      if (!t) return;
      if (t.status === "queued") {
        patch(taskId, { status: "cancelled", stage: "Cancelled", finishedAt: Date.now() });
        finishBatchIfDone(t.batchId);
      } else if (t.status === "running") controllers.get(taskId)?.abort();
    },
    retry: (taskId) => {
      const t = get().tasks[taskId];
      if (!t || !(t.status === "failed" || t.status === "cancelled")) return;
      patch(taskId, { status: "queued", stage: "Queued", progress: 0, error: undefined, outputs: [], warnings: [] });
      set((s) => ({ batches: { ...s.batches, [t.batchId]: { ...s.batches[t.batchId], logged: false } } }));
      schedule();
    },
    retryFailed: (batchId) => {
      const s = get();
      s.order.forEach((id) => {
        const t = s.tasks[id];
        if (t.batchId === batchId && (t.status === "failed" || t.status === "cancelled")) get().retry(id);
      });
    },
    removeBatch: (batchId) => {
      const s = get();
      const keep = s.order.filter((id) => s.tasks[id].batchId !== batchId || s.tasks[id].status === "running");
      const tasks: Record<string, Task> = {};
      for (const id of s.order) {
        if (keep.includes(id)) tasks[id] = s.tasks[id];
        else {
          s.tasks[id].outputs.forEach((o) => URL.revokeObjectURL(o.url));
          specs.delete(id);
        }
      }
      const batches = { ...s.batches };
      if (!keep.some((id) => tasks[id].batchId === batchId)) delete batches[batchId];
      set({ tasks, order: keep, batches, batchOrder: s.batchOrder.filter((b) => batches[b]) });
    },
    clearFinished: () => {
      const s = get();
      s.batchOrder.forEach((b) => {
        const ts = s.order.map((id) => s.tasks[id]).filter((t) => t.batchId === b);
        if (ts.every((t) => t.status !== "queued" && t.status !== "running")) get().removeBatch(b);
      });
    },
  };
});

export function humanError(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const err = e as Error;
  const msg = err.message || String(e);
  if (/out of memory|allocation failed|RangeError: Array buffer/i.test(msg))
    return "The browser ran out of memory for this file. Try a smaller file or close other tabs.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Network error — the processing server could not be reached.";
  if (/HTTP 404|Server returned HTTP 404/i.test(msg))
    return "The server operation route was not found (HTTP 404). Ensure the processing backend is active or use client-side operations.";
  if (/encrypted/i.test(msg) && /pdf/i.test(msg))
    return "This PDF is encrypted. Unlock it first with the Unlock PDF tool.";
  return msg;
}

/** Selectors */
export function batchTasks(state: QueueState, batchId: string | null | undefined): Task[] {
  if (!batchId) return [];
  return state.order.map((id) => state.tasks[id]).filter((t) => t && t.batchId === batchId);
}

export function batchSummary(tasks: Task[]) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const failed = tasks.filter((t) => t.status === "failed").length;
  const cancelled = tasks.filter((t) => t.status === "cancelled").length;
  const running = tasks.filter((t) => t.status === "running").length;
  const queued = tasks.filter((t) => t.status === "queued").length;
  const finished = completed + failed + cancelled;
  // Overall progress: finished tasks count fully; running tasks contribute their real fraction (0 when indeterminate).
  const progress = total ? (finished + tasks.filter((t) => t.status === "running").reduce((n, t) => n + (t.progress ?? 0), 0)) / total : 0;
  const done = total > 0 && queued === 0 && running === 0;
  const bytesIn = tasks.filter((t) => t.status === "completed").reduce((n, t) => n + t.inputSize, 0);
  const bytesOut = tasks.reduce((n, t) => n + t.outputs.reduce((m, o) => m + o.blob.size, 0), 0);
  return { total, completed, failed, cancelled, running, queued, finished, progress, done, bytesIn, bytesOut };
}
