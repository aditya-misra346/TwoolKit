"use client";

import { useSettings } from "@/stores/settings";
import { useHistory } from "@/stores/history";
import {
  isTauriDesktop,
  getDesktopRuntimeInfo,
  authorizeDesktopDirectory,
  getAuthorizedDirectories,
  revokeAuthorizedDirectory,
  checkWebsiteSyncStatus,
  checkNativeDesktopUpdate,
  secureVaultSet,
  secureVaultGet,
  secureVaultDelete,
  type DesktopRuntimeInfo,
  type WebsiteSyncReport,
  type NativeUpdateStatus,
} from "@/lib/desktop";
import {
  Settings,
  Shield,
  Trash2,
  Sparkles,
  Key,
  RotateCcw,
  CheckCircle2,
  Cpu,
  RefreshCw,
  FolderCheck,
  FolderPlus,
  Download,
  UserCheck,
  LogOut,
  HardDrive,
} from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";

export default function SettingsPage() {
  const {
    cloudConsent,
    purgeServerAfterDownload,
    maxOutputStorageMB,
    localConcurrency,
    geminiApiKey,
    set,
    reset,
  } = useSettings();

  const { resetStats, clearOutputs, clearActivities } = useHistory();

  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Desktop Runtime, Sync, and Updater state
  const [runtimeInfo, setRuntimeInfo] = useState<DesktopRuntimeInfo | null>(null);
  const [authorizedDirs, setAuthorizedDirs] = useState<string[]>([]);
  const [updateChannel, setUpdateChannel] = useState<"stable" | "beta">("stable");
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [syncReport, setSyncReport] = useState<WebsiteSyncReport | null>(null);
  const [nativeUpdate, setNativeUpdate] = useState<NativeUpdateStatus | null>(null);
  const [checkingSync, setCheckingSync] = useState(false);
  const [checkingNative, setCheckingNative] = useState(false);

  // Account & Secure Credential Vault state
  const [accountEmail, setAccountEmail] = useState("");
  const [signedInUser, setSignedInUser] = useState<string | null>(null);

  useEffect(() => {
    void getDesktopRuntimeInfo().then((info) => {
      setRuntimeInfo(info);
      setAuthorizedDirs(info.authorizedDirectories || []);
    });
    void getAuthorizedDirectories().then((dirs) => {
      if (dirs.length > 0) setAuthorizedDirs(dirs);
    });
    void secureVaultGet("account_user").then((u) => {
      if (u) setSignedInUser(u);
    });
  }, []);

  const handleSaveApiKey = async () => {
    const trimmed = apiKeyInput.trim();
    set({ geminiApiKey: trimmed });
    await secureVaultSet("gemini_api_key", trimmed);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleCheckWebsiteSync = async () => {
    setCheckingSync(true);
    try {
      const rep = await checkWebsiteSyncStatus("");
      setSyncReport(rep);
    } finally {
      setCheckingSync(false);
    }
  };

  const handleCheckNativeUpdate = async () => {
    setCheckingNative(true);
    try {
      const status = await checkNativeDesktopUpdate(updateChannel);
      setNativeUpdate(status);
    } finally {
      setCheckingNative(false);
    }
  };

  const handleAddAuthorizedFolder = async () => {
    const chosen = await authorizeDesktopDirectory();
    if (chosen) {
      const updated = await getAuthorizedDirectories();
      setAuthorizedDirs(updated);
    } else if (!isTauriDesktop()) {
      alert(
        "Scoped persistent folder grants are a native TwoolKit Desktop capability. Download TwoolKit Desktop from /download or use the File Scanner in your browser."
      );
    }
  };

  const handleRevokeFolder = async (path: string) => {
    const updated = await revokeAuthorizedDirectory(path);
    setAuthorizedDirs(updated);
  };

  const handleSignIn = async () => {
    if (!accountEmail.trim()) return;
    await secureVaultSet("account_user", accountEmail.trim());
    setSignedInUser(accountEmail.trim());
    setAccountEmail("");
  };

  const handleSignOut = async () => {
    await secureVaultDelete("account_user");
    setSignedInUser(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Platform Preferences & Update Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Configure desktop update channels, live website synchronization, authorized local folders, processing privacy, and secure credentials.
          </p>
        </div>

        <Link
          href="/download"
          className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold flex items-center gap-2 self-start"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Desktop Installers</span>
        </Link>
      </div>

      <div className="space-y-4">
        {/* Section 1: Updates & Live Website Synchronization Center */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-500" />
              <span>1. Updates & Live Website Synchronization</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold font-mono">
              v{runtimeInfo?.nativeVersion || "1.2.0"} · {runtimeInfo?.isDesktop ? "Native Tauri 2" : "Web Connected"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            {/* Live Website Sync Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Website UI Synchronization</span>
                  <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                    twoolkit.vercel.app
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Automatically synchronizes UI and tool improvements deployed to the production website without reinstalling the desktop application.
                </p>
                {syncReport && (
                  <div className="mt-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono">
                    <div>
                      Status:{" "}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {syncReport.upToDate ? "Synchronized (Latest)" : `Update ${syncReport.remoteSha} Ready`}
                      </strong>
                    </div>
                    <div className="text-slate-400">
                      Build SHA: {syncReport.remoteSha} · Min Native: v{syncReport.minDesktopVersion}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleCheckWebsiteSync}
                disabled={checkingSync}
                className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={clsx("w-3.5 h-3.5", checkingSync && "animate-spin")} />
                <span>{checkingSync ? "Checking Live Website..." : "Verify Website Sync Now"}</span>
              </button>
            </div>

            {/* Native Desktop Updater Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Native Desktop Binary Updater</span>
                  <div className="inline-flex p-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700 text-[10px]">
                    {(["stable", "beta"] as const).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setUpdateChannel(ch)}
                        className={clsx(
                          "px-2 py-0.5 rounded capitalize cursor-pointer",
                          updateChannel === ch
                            ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold"
                            : "text-slate-500"
                        )}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Delivers Ed25519 cryptographically signed updates for Rust native commands, filesystem capabilities, and OS integrations.
                </p>

                <label className="flex items-center gap-2 mt-2 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoUpdateEnabled}
                    onChange={(e) => setAutoUpdateEnabled(e.target.checked)}
                    className="accent-blue-600 w-3.5 h-3.5"
                  />
                  <span>Automatically check & download signed updates</span>
                </label>

                {nativeUpdate && (
                  <div className="mt-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono">
                    <div>
                      {nativeUpdate.available
                        ? `Update Available: v${nativeUpdate.latestVersion}`
                        : `Up to date (v${nativeUpdate.currentVersion} · Ed25519 Verified)`}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleCheckNativeUpdate}
                disabled={checkingNative}
                className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5 text-blue-500" />
                <span>{checkingNative ? "Checking Release Server..." : "Check for Native Updates"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Authorized Local Folders & Scoped Permissions */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <FolderCheck className="w-4 h-4 text-indigo-500" />
              <span>2. Authorized Folders & Scoped Filesystem Access</span>
            </span>
            <button
              type="button"
              onClick={handleAddAuthorizedFolder}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Authorize Folder</span>
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            TwoolKit Desktop enforces strict path allowlisting. Native Rust filesystem commands can only access directories you explicitly grant below.
          </p>

          {authorizedDirs.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 text-center">
              No persistent directory grants active. Click &quot;Authorize Folder&quot; in TwoolKit Desktop to grant scoped access.
            </div>
          ) : (
            <div className="space-y-1.5">
              {authorizedDirs.map((dir) => (
                <div
                  key={dir}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-slate-800 dark:text-slate-200 truncate">
                    {dir}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevokeFolder(dir)}
                    className="text-rose-500 hover:underline text-[11px] font-semibold ml-3 shrink-0 cursor-pointer"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Processing Privacy & Retention */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3">
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>3. Processing Privacy & Resource Limits</span>
          </span>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <div className="max-w-xl">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Allow Server / Hybrid Processing Engine
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed block mt-0.5">
                  Allows sending files to the configured TWOOLKIT processing server for heavy conversions like LibreOffice DOCX/PPTX to PDF.
                </span>
              </div>
              <input
                type="checkbox"
                checked={cloudConsent}
                onChange={(e) => set({ cloudConsent: e.target.checked })}
                className="w-4 h-4 accent-blue-600 cursor-pointer ml-3 shrink-0"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <div className="max-w-xl">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Instant Server Temp Purge After Download
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed block mt-0.5">
                  Immediately deletes the isolated server job directory as soon as the output file is delivered.
                </span>
              </div>
              <input
                type="checkbox"
                checked={purgeServerAfterDownload}
                onChange={(e) => set({ purgeServerAfterDownload: e.target.checked })}
                className="w-4 h-4 accent-blue-600 cursor-pointer ml-3 shrink-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Max Parallel Tasks:
              </label>
              <select
                value={localConcurrency}
                onChange={(e) => set({ localConcurrency: parseInt(e.target.value, 10) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
              >
                <option value={1}>1 (Low memory devices)</option>
                <option value={2}>2 tasks</option>
                <option value={3}>3 tasks (Recommended)</option>
                <option value={4}>4 tasks</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Max Output Cache in IndexedDB (MB):
              </label>
              <input
                type="number"
                min={50}
                max={5000}
                value={maxOutputStorageMB}
                onChange={(e) => set({ maxOutputStorageMB: parseInt(e.target.value, 10) || 500 })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Account Synchronization & Secure Credential Vault */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-500" />
              <span>5. Account Sync & Encrypted Credential Vault</span>
            </span>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              OS Vault Protected
            </span>
          </div>

          {/* Account Session */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            {signedInUser ? (
              <>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Signed in as {signedInUser}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Session token stored in encrypted vault · Preferences synchronized
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                <input
                  type="email"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  placeholder="Enter TwoolKit account email to sync preferences..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-blue-600 text-white font-semibold text-xs cursor-pointer shrink-0"
                >
                  Connect Account
                </button>
              </div>
            )}
          </div>

          {/* Gemini API Key */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Intelligent File Assistant (Gemini API Key):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                placeholder="Paste Gemini API Key (stored in encrypted vault)..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:outline-hidden"
              />
              <button
                onClick={handleSaveApiKey}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                {savedSuccess ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                ) : (
                  <Key className="w-3.5 h-3.5" />
                )}
                <span>{savedSuccess ? "Saved to Vault!" : "Save Key"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 6: Cache Management & Reset */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (confirm("Clear cached output files and activity timeline?")) {
                  void clearOutputs();
                  void clearActivities();
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Clear Application Cache</span>
            </button>
          </div>

          <button
            onClick={() => {
              if (confirm("Reset all settings and statistics to default values?")) {
                reset();
                void resetStats();
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Preferences & Stats</span>
          </button>
        </div>
      </div>
    </div>
  );
}
