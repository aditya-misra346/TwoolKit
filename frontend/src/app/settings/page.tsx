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
  Cpu,
  Lock,
} from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

export default function SettingsPage() {
  const {
    theme,
    cloudConsent,
    purgeServerAfterDownload,
    maxOutputStorageMB,
    localConcurrency,
    geminiApiKey,
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
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-150">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-slate-700 dark:text-slate-300" />
          Platform Preferences & Privacy
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Configure interface theme, local host server consent, automatic file purge retention, parallel task limits, and AI keys.
        </p>
      </div>

      <div className="space-y-4">
        {/* Section 1: Appearance & Theme */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3">
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
            Interface Theme
          </span>
          <div className="grid grid-cols-3 gap-2.5 max-w-md">
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
                    "p-3 rounded-xl border text-center text-xs font-bold transition-all flex flex-col items-center gap-1.5 cursor-pointer",
                    theme === t.id
                      ? "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100 shadow-2xs"
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
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3">
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>Processing Privacy & Retention</span>
          </span>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
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
                className="w-4 h-4 accent-blue-600 cursor-pointer ml-3 shrink-0"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <div className="max-w-xl">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Instant Server Temp Purge After Download
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed block mt-0.5">
                  Immediately deletes the isolated server job directory as soon as the output file is delivered to your browser.
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
        </div>

        {/* Section 3: Performance & Limits */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3">
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
            Performance & Resource Limits
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Max In-Browser Parallel Tasks:
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

        {/* Section 4: Gemini API Integration */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Intelligent Document Assistant (Gemini API)</span>
            </span>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              Optional
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Vellum includes built-in local heuristics for document inspection. Providing a Google Gemini API Key enables deep semantic summarization, key fact extraction, and conversion compatibility scoring.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="Paste Gemini API Key (AIza...)"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:outline-hidden"
            />
            <button
              onClick={handleSaveApiKey}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              {savedSuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <Key className="w-3.5 h-3.5" />}
              <span>{savedSuccess ? "Saved!" : "Save Key"}</span>
            </button>
          </div>
        </div>

        {/* Section 5: Reset Actions */}
        <div className="pt-2 flex items-center justify-between">
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
