"use client";

/**
 * Global Desktop Experience, Live Website Synchronization & Offline Resilience Provider.
 *
 * Responsibilities:
 * 1. Global Desktop Keyboard Shortcuts:
 *    - Cmd/Ctrl + O       -> Open files (scanner / intake)
 *    - Cmd/Ctrl + K       -> Universal command palette (handled alongside Header)
 *    - Cmd/Ctrl + ,       -> Open Settings (/settings)
 *    - Cmd/Ctrl + Shift+U -> Upload files (/pdf or dashboard intake)
 *    - Cmd/Ctrl + Q       -> Quit desktop application cleanly
 * 2. Automatic Website Synchronization Engine:
 *    - Periodically polls /api/desktop-manifest and checks on window focus.
 *    - Verifies `minDesktopVersion` compatibility against native desktop shell.
 *    - Never interrupts active jobs in `useQueue`.
 *    - Shows a discreet notification banner when a newer website build is available.
 * 3. Network & Backend Connectivity Resilience:
 *    - Tracks online/offline state and backend availability.
 *    - Displays a non-intrusive status banner when running offline in Local-Only mode.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueue } from "@/stores/tasks";
import {
  isTauriDesktop,
  checkWebsiteSyncStatus,
  invokeTauri,
  type WebsiteSyncReport,
} from "@/lib/desktop";
import {
  RefreshCw,
  WifiOff,
  Sparkles,
  X,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

export function DesktopBridgeProvider() {
  const router = useRouter();
  const { order, tasks } = useQueue();

  const [isOffline, setIsOffline] = useState(false);
  const [baselineSha, setBaselineSha] = useState<string>("");
  const [syncUpdate, setSyncUpdate] = useState<WebsiteSyncReport | null>(null);
  const [dismissedSha, setDismissedSha] = useState<string | null>(null);

  const hasActiveTasks = order.some(
    (id) => tasks[id]?.status === "running" || tasks[id]?.status === "queued"
  );

  // 1. Track network online/offline resilience
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 2. Global Desktop Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();

      // Cmd/Ctrl + , -> Settings
      if (key === ",") {
        e.preventDefault();
        router.push("/settings");
        return;
      }

      // Cmd/Ctrl + O -> Open File Scanner / Native Folder Picker
      if (key === "o" && !e.shiftKey) {
        e.preventDefault();
        router.push("/scanner");
        return;
      }

      // Cmd/Ctrl + Shift + U -> Universal Upload on Dashboard
      if (key === "u" && e.shiftKey) {
        e.preventDefault();
        router.push("/");
        return;
      }

      // Cmd/Ctrl + Q -> Quit Desktop Application (when running inside Tauri)
      if (key === "q" && isTauriDesktop()) {
        e.preventDefault();
        if (hasActiveTasks) {
          if (!confirm("Active file conversions are still running. Quit TwoolKit Desktop anyway?")) {
            return;
          }
        }
        void invokeTauri("quit_application").catch(() => {});
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, hasActiveTasks]);

  // 3. Automatic Website Synchronization Poller
  const runSyncCheck = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.onLine) return;
    try {
      const report = await checkWebsiteSyncStatus(baselineSha);
      if (!baselineSha && report.remoteSha) {
        setBaselineSha(report.remoteSha);
        return;
      }
      if (!report.upToDate && report.remoteSha !== dismissedSha) {
        setSyncUpdate(report);
      }
    } catch {
      // Ignore transient network errors during background poll
    }
  }, [baselineSha, dismissedSha]);

  useEffect(() => {
    // Initial check after hydration
    const initTimer = setTimeout(() => {
      void runSyncCheck();
    }, 2500);

    // Periodic check every 5 minutes
    const interval = setInterval(() => {
      void runSyncCheck();
    }, 5 * 60 * 1000);

    // Check when window regains focus
    const onFocus = () => {
      void runSyncCheck();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [runSyncCheck]);

  const handleApplyWebsiteUpdate = () => {
    if (hasActiveTasks) {
      alert("Please wait for your active file conversion to finish before reloading.");
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("_sync", syncUpdate?.remoteSha || String(Date.now()));
    window.location.replace(url.toString());
  };

  return (
    <>
      {/* Offline Resilience Banner */}
      {isOffline && (
        <div className="bg-amber-500/95 text-white px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 z-50 shadow-xs">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>
            Offline Mode Active — In-browser & native Rust tools (Scanner, PDF Merge/Split/Protect, Image Studio, ZIP) remain 100% operational. Cloud server conversions are paused until connection is restored.
          </span>
        </div>
      )}

      {/* Discreet Live Website Synchronization Toast */}
      {syncUpdate && !hasActiveTasks && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl bg-slate-900 dark:bg-slate-800 text-white p-4 shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                {syncUpdate.requiresNativeUpdate ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold">
                  {syncUpdate.requiresNativeUpdate
                    ? "Native Desktop Update Required"
                    : `TwoolKit Web Update Ready (${syncUpdate.remoteSha})`}
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  {syncUpdate.requiresNativeUpdate
                    ? `The latest website deployment requires TwoolKit Desktop v${syncUpdate.minDesktopVersion}+.`
                    : "A new version of TwoolKit has been deployed. Synchronize instantaneously without reinstalling."}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setDismissedSha(syncUpdate.remoteSha);
                setSyncUpdate(null);
              }}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
              aria-label="Dismiss update notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            {syncUpdate.requiresNativeUpdate ? (
              <Link
                href="/download"
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5"
              >
                <span>Download Native Update</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <button
                onClick={handleApplyWebsiteUpdate}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Synchronize Now</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
