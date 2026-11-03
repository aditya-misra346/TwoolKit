"use client";

import { useSettings } from "@/stores/settings";
import { useHistory } from "@/stores/history";
import {
  Settings,
  Shield,
  Moon,
  Sun,
  Laptop,
  Trash2,
  Sparkles,
  Key,
  Sliders,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

export default function SettingsPage() {
  const {
    theme,
    cloudConsent,
    purgeServerAfterDownload,
    keepOutputs,
    maxOutputStorageMB,
    localConcurrency,
    serverConcurrency,
    defaultImageFormat,
    defaultImageQuality,
    geminiApiKey,
    geminiModel,
    set,
    reset,
  } = useSettings();

  const { resetStats } = useHistory();
  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveApiKey = () => {
    set({ geminiApiKey: apiKeyInput.trim() });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-slate-700 dark:text-slate-300" />
          Platform Settings & Privacy
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Configure security, privacy retention policies, local concurrency, theme, and AI capabilities.
        </p>
      </div>

      <div className="space-y-6">
        {/* Section 1: Appearance & Theme */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
            Appearance & Interface Theme
          </h2>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            {[
              { id: "system", label: "System", icon: Laptop },
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set({ theme: t.id as any })}
                  className={clsx(
                    "p-3 rounded-2xl border text-center text-xs font-bold transition-all flex flex-col items-center gap-2",
                    theme === t.id
                      ? "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Privacy & Server Processing */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            Privacy & Processing Architecture
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div className="max-w-xl">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Allow Local Server Processing
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed block mt-0.5">
                  Allows sending files to the localhost Vellum engine (127.0.0.1:8000) for heavy conversions like LibreOffice DOCX/PPTX to PDF.
                </span>
              </div>
              <input
                type="checkbox"
                checked={cloudConsent}
                onChange={(e) => set({ cloudConsent: e.target.checked })}
                className="w-5 h-5 accent-blue-600 rounded-sm cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div className="max-w-xl">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Purge Server Temp Files Immediately After Download
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed block mt-0.5">
                  Sends an instant DELETE request to wipe the isolated job directory as soon as the browser receives the output bytes.
                </span>
              </div>
              <input
                type="checkbox"
                checked={purgeServerAfterDownload}
                onChange={(e) => set({ purgeServerAfterDownload: e.target.checked })}
                className="w-5 h-5 accent-blue-600 rounded-sm cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Concurrency & Storage Quota */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
            Performance & Batch Limits
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Max In-Browser Parallel Tasks:
              </label>
              <select
                value={localConcurrency}
                onChange={(e) => set({ localConcurrency: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                <option value={1}>1 (Low memory devices)</option>
                <option value={2}>2 tasks</option>
                <option value={3}>3 tasks (Recommended)</option>
                <option value={4}>4 tasks</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Max IndexedDB Output Cache (MB):
              </label>
              <input
                type="number"
                min={50}
                max={5000}
                value={maxOutputStorageMB}
                onChange={(e) => set({ maxOutputStorageMB: parseInt(e.target.value, 10) || 500 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Intelligent File Assistant (Gemini API) */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Intelligent File Assistant (Gemini API)
            </h2>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-sm">
              Optional
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            By default, Vellum performs rich local heuristic analysis. If you provide a Google Gemini API Key, Vellum will query Gemini Flash directly from your browser to summarize complex PDFs, generate executive briefs, and advise on formatting.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="Paste Gemini API Key (AIza...)"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
            />
            <button
              onClick={handleSaveApiKey}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5"
            >
              {savedSuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Key className="w-3.5 h-3.5" />}
              {savedSuccess ? "Saved!" : "Save Key"}
            </button>
          </div>
        </div>

        {/* Section 5: Reset Actions */}
        <div className="pt-4 flex items-center justify-between">
          <button
            onClick={() => {
              if (confirm("Reset all settings and statistics to default values?")) {
                reset();
                void resetStats();
              }
            }}
            className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All Preferences & Stats
          </button>
        </div>
      </div>
    </div>
  );
}
