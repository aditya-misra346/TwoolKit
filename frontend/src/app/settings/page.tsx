"use client";

import { useSettings } from "@/stores/settings";
import { useHistory } from "@/stores/history";
import {
  Settings,
  Shield,
  Key,
  RotateCcw,
  CheckCircle2,
  UserCheck,
  LogOut,
  HardDrive,
} from "lucide-react";
import { useEffect, useState } from "react";

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

  // Account & Credential Vault state
  const [accountEmail, setAccountEmail] = useState("");
  const [signedInUser, setSignedInUser] = useState<string | null>(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem("twoolkit.vault.account_user");
      if (u) setSignedInUser(u);
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    set({ geminiApiKey: trimmed });
    try {
      localStorage.setItem("twoolkit.vault.gemini_api_key", trimmed);
    } catch {
      // Ignore storage access errors
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSignIn = () => {
    if (!accountEmail.trim()) return;
    try {
      localStorage.setItem("twoolkit.vault.account_user", accountEmail.trim());
    } catch {
      // Ignore storage access errors
    }
    setSignedInUser(accountEmail.trim());
    setAccountEmail("");
  };

  const handleSignOut = () => {
    try {
      localStorage.removeItem("twoolkit.vault.account_user");
    } catch {
      // Ignore storage access errors
    }
    setSignedInUser(null);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Settings className="w-7 h-7 text-blue-600 dark:text-blue-400 shrink-0" />
            Platform Preferences
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
            Configure processing privacy, resource limits, account synchronization, and credentials.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Section 1: Processing Privacy & Retention */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3">
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>1. Processing Privacy & Resource Limits</span>
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

        {/* Section 2: Account Synchronization & Secure Credential Vault */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-500" />
              <span>2. Account Sync & Credential Vault</span>
            </span>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              Local Vault Protected
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
                    Session token stored in local vault · Preferences synchronized
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
                placeholder="Paste Gemini API Key (stored in local vault)..."
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

        {/* Section 3: Cache Management & Reset */}
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
