"use client";

import { useSettings } from "@/stores/settings";
import { Shield, Server, Check, X, Lock, Trash2, Cpu } from "lucide-react";

interface ConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}

export function ConsentModal({ isOpen, onClose, onConfirm }: ConsentModalProps) {
  const { cloudConsent, set, purgeServerAfterDownload } = useSettings();

  if (!isOpen) return null;

  const handleGrant = () => {
    set({ cloudConsent: true });
    onConfirm?.();
    onClose();
  };

  const handleRevoke = () => {
    set({ cloudConsent: false });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Server Processing & Privacy
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
            Vellum runs <strong>in-browser first</strong> for PDF manipulation, scanning, duplicate detection, and image editing.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
            Certain advanced conversions (like <em>Word/PowerPoint ↔ PDF</em> using headless LibreOffice, <em>PDF to DOCX layout reconstruction</em>, and <em>slide video rendering</em>) require uploading the file to the local Vellum server engine on this machine.
          </p>
        </div>

        {/* Guarantees */}
        <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span className="text-slate-700 dark:text-slate-300">
              <strong>Isolated Temp Directory:</strong> Uploaded files live in an isolated directory with 0700 permissions.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <Trash2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span className="text-slate-700 dark:text-slate-300">
              <strong>Automatic Deletion:</strong> {purgeServerAfterDownload ? "Files are deleted immediately after download to the browser" : "Files are wiped after 30 minutes"} by the retention engine.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span className="text-slate-700 dark:text-slate-300">
              <strong>Local Host:</strong> The server runs on <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-sm">127.0.0.1:8000</code> and never sends files to external third-party clouds.
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {cloudConsent ? (
            <button
              onClick={handleRevoke}
              className="flex-1 py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 font-semibold text-sm hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              Revoke Consent (Local Only)
            </button>
          ) : (
            <button
              onClick={handleGrant}
              className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Allow Server Processing
            </button>
          )}
          <button
            onClick={onClose}
            className="py-2.5 px-5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
