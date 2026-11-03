"use client";
/**
 * Client for the TWOOLKIT processing API (proxied same-origin under /api).
 * Upload progress uses XHR (real byte counts); job progress comes from the
 * server's own work-unit accounting; downloads stream with byte progress.
 */
import { useSettings } from "@/stores/settings";

export interface Capabilities {
  engines: Record<string, { available: boolean; version?: string | null; detail?: string; codec?: string; container?: string; heif?: boolean; avif?: boolean }>;
  ops: Record<string, { available: boolean; reason: string | null }>;
  limits: { maxFileMB: number; maxFilesPerJob: number; retentionMinutes: number };
}

export interface JobStatus {
  id: string;
  op: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number | null;
  stage: string;
  outputs: { index: number; name: string; size: number; mime: string; note: string | null }[];
  warnings: string[];
  error: string | null;
  scan?: { name: string; status: "clean" | "infected" | "error"; signature?: string; detail?: string }[] | null;
  expiresAt: number | null;
}

export class ApiError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

export class CancelledError extends Error {
  constructor() {
    super("Cancelled");
  }
}

let capsCache: { at: number; value: Capabilities | null; error?: string } | null = null;

export async function fetchCapabilities(force = false): Promise<Capabilities | null> {
  if (!force && capsCache && Date.now() - capsCache.at < 30_000) return capsCache.value;
  try {
    const r = await fetch("/api/capabilities", { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const value = (await r.json()) as Capabilities;
    capsCache = { at: Date.now(), value };
    return value;
  } catch (e) {
    capsCache = { at: Date.now(), value: null, error: String(e) };
    return null;
  }
}

function uploadJob(
  op: string,
  files: File[] | Blob[],
  options: Record<string, unknown>,
  names: string[],
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("op", op);
    fd.append("options", JSON.stringify(options ?? {}));
    files.forEach((f, i) => fd.append("files", f, names[i]));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/jobs");
    xhr.setRequestHeader("X-Cloud-Consent", "granted");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded, e.total);
    xhr.onload = () => {
      const body = xhr.response ?? {};
      if (xhr.status === 202) resolve(body.id);
      else reject(new ApiError(body.error || body.detail || `Server returned HTTP ${xhr.status}`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Could not reach the processing server. Is it running?", 0));
    xhr.onabort = () => reject(new CancelledError());
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(fd);
  });
}

async function downloadWithProgress(url: string, signal: AbortSignal, onProgress: (loaded: number, total: number) => void): Promise<Blob> {
  const r = await fetch(url, { signal, cache: "no-store" });
  if (!r.ok) {
    let msg = `Download failed (HTTP ${r.status})`;
    try {
      msg = (await r.json()).detail ?? msg;
    } catch {}
    throw new ApiError(msg, r.status);
  }
  const total = Number(r.headers.get("content-length") || 0);
  const type = r.headers.get("content-type") || "application/octet-stream";
  if (!r.body) return new Blob([await r.arrayBuffer()], { type });
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, total);
  }
  return new Blob(chunks as BlobPart[], { type });
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      rej(new CancelledError());
    }, { once: true });
  });

export interface ServerResult {
  files: { name: string; blob: Blob; note: string | null }[];
  warnings: string[];
  job: JobStatus;
}

/**
 * Run a server job end-to-end: upload → poll → download all outputs → (optionally) purge.
 * `report(progress|null, stage)` receives real progress for each phase.
 */
export async function runServerJob(
  op: string,
  files: (File | Blob)[],
  names: string[],
  options: Record<string, unknown>,
  signal: AbortSignal,
  report: (p: number | null, stage: string) => void
): Promise<ServerResult> {
  const settings = useSettings.getState();
  if (!settings.cloudConsent) throw new ApiError("Server processing is turned off. Allow it in the consent dialog or Settings.", 428);
  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  // Phase weights: upload 0–25%, processing 25–90%, download 90–100%
  report(0, "Uploading");
  const id = await uploadJob(op, files as File[], options, names, signal, (l, t) =>
    report(0.25 * (l / (t || totalBytes || 1)), `Uploading · ${Math.round((100 * l) / (t || 1))}%`)
  );
  let cancelled = false;
  const onAbort = () => {
    cancelled = true;
    void fetch(`/api/jobs/${id}/cancel`, { method: "POST" }).catch(() => {});
  };
  signal.addEventListener("abort", onAbort, { once: true });
  let job: JobStatus;
  let delay = 400;
  for (;;) {
    await sleep(delay, signal);
    delay = Math.min(1200, delay + 100);
    const r = await fetch(`/api/jobs/${id}`, { cache: "no-store", signal });
    if (!r.ok) throw new ApiError(r.status === 404 ? "The job disappeared from the server (expired or deleted)." : `Status check failed (HTTP ${r.status})`, r.status);
    job = await r.json();
    if (job.status === "queued") report(0.25, "Waiting in server queue");
    else if (job.status === "running") report(job.progress == null ? null : 0.25 + 0.65 * job.progress, job.stage);
    else break;
  }
  if (cancelled || job.status === "cancelled") throw new CancelledError();
  if (job.status === "failed") {
    void fetch(`/api/jobs/${id}`, { method: "DELETE" }).catch(() => {});
    throw new ApiError(job.error || "Processing failed on the server.");
  }
  const out: ServerResult["files"] = [];
  const outBytes = job.outputs.reduce((n, o) => n + o.size, 0) || 1;
  let done = 0;
  for (const o of job.outputs) {
    const blob = await downloadWithProgress(`/api/jobs/${id}/outputs/${o.index}`, signal, (l) =>
      report(0.9 + 0.1 * ((done + l) / outBytes), "Downloading result")
    );
    done += o.size;
    out.push({ name: o.name, blob: new Blob([blob], { type: o.mime.split(";")[0] }), note: o.note });
  }
  signal.removeEventListener("abort", onAbort);
  if (settings.purgeServerAfterDownload) void fetch(`/api/jobs/${id}`, { method: "DELETE" }).catch(() => {});
  return { files: out, warnings: job.warnings, job };
}
