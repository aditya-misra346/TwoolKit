"use client";

import { useEffect, useState } from "react";
import { detectClientPlatform, isTauriDesktop } from "@/lib/desktop";
import { Logo } from "@/components/Logo";
import {
  Download,
  Monitor,
  Apple,
  Terminal,
  ShieldCheck,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  Cpu,
  ArrowRight,
  Lock,
  Sparkles,
  Layers,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

interface InstallerItem {
  id: string;
  label: string;
  arch: string;
  format: string;
  filename: string;
  sizeMB: number;
  url: string;
}

interface ManifestPayload {
  product: string;
  appVersion: string;
  gitSha: string;
  releaseDate: string;
  minDesktopVersion: string;
  releaseNotes: string[];
  installers: {
    macos: InstallerItem[];
    windows: InstallerItem[];
    linux: InstallerItem[];
  };
}

export default function DesktopDownloadPage() {
  const [detected, setDetected] = useState<{
    os: "macos" | "windows" | "linux";
    arch: "aarch64" | "x86_64";
    label: string;
  }>({ os: "macos", arch: "aarch64", label: "macOS (Apple Silicon)" });

  const [activeTab, setActiveTab] = useState<"macos" | "windows" | "linux">("macos");
  const [manifest, setManifest] = useState<ManifestPayload | null>(null);
  const [runningInDesktop, setRunningInDesktop] = useState(false);

  useEffect(() => {
    const plat = detectClientPlatform();
    setDetected(plat);
    setActiveTab(plat.os);
    setRunningInDesktop(isTauriDesktop());

    void fetch("/api/desktop-manifest", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setManifest(data))
      .catch(() => {});
  }, []);

  const version = manifest?.appVersion || "1.2.0";
  const releaseDate = manifest?.releaseDate || "2026-11-04";
  const gitSha = manifest?.gitSha || "e708bad";

  const primaryInstaller: InstallerItem | null = manifest
    ? manifest.installers[detected.os]?.find((i) => i.arch === detected.arch) ||
      manifest.installers[detected.os]?.[0] ||
      null
    : null;

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in duration-200">
      {/* 1. Hero Download Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-6 sm:p-8 shadow-xs bg-subtle-grid">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-xs font-semibold text-blue-700 dark:text-blue-300">
              <Cpu className="w-3.5 h-3.5" />
              <span>Powered by Tauri 2 + Rust · v{version} ({gitSha})</span>
            </div>

            <div className="flex items-center gap-3.5">
              <Logo variant="icon" size="lg" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  TwoolKit Desktop
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Native macOS, Windows & Linux application with automatic live website sync
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Experience all 48 TwoolKit PDF, Document, Presentation, Image, and Storage tools with native operating-system file dialogs, multi-threaded Rust folder scanning, offline resilience, and instant zero-reinstall synchronization with{" "}
              <code className="font-mono text-blue-600 dark:text-blue-400">twoolkit.vercel.app</code>.
            </p>

            {/* Primary Auto-Detected OS Download CTA */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              {primaryInstaller ? (
                <a
                  href={primaryInstaller.url}
                  className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center gap-2.5"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    Download for {detected.label} ({primaryInstaller.format})
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/20 text-[11px] font-mono">
                    {primaryInstaller.sizeMB} MB
                  </span>
                </a>
              ) : (
                <a
                  href="https://github.com/aditya-misra346/TwoolKit/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center gap-2.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Download for {detected.label}</span>
                </a>
              )}

              <Link
                href="/settings"
                className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Update & Sync Center</span>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
              <span>Latest Release: <strong className="text-slate-700 dark:text-slate-300">v{version}</strong> ({releaseDate})</span>
              <span>·</span>
              <span>Ed25519 Signed Updater</span>
              <span>·</span>
              <span>{runningInDesktop ? "Running inside TwoolKit Desktop" : `Detected OS: ${detected.label}`}</span>
            </div>
          </div>

          {/* Right Column: Architecture Highlights Card */}
          <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-950/90 border border-slate-200/80 dark:border-slate-800/80 space-y-3.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Desktop Architecture Advantages
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <RefreshCw className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    Instant Live Website Synchronization
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    When new UI or tool updates are pushed to <code className="font-mono">main</code> and deployed to Vercel, TwoolKit Desktop synchronizes automatically without reinstalling.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <HardDrive className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    Scoped Native Rust Filesystem Engine
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Scan user-authorized local directories at native speed with SHA-256 hashing, magic-byte inspection, and direct output saving.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    Cryptographically Signed Native Updater
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Native Rust and Tauri 2 capability updates are verified with Ed25519 public-key signatures before installation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Platform Installers Matrix (macOS, Windows, Linux) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              All Platform Installers & Packages
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select your operating system and CPU architecture (`aarch64` or `x86_64`)
            </p>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-xs font-semibold self-start">
            {[
              { id: "macos" as const, label: "macOS", icon: Apple },
              { id: "windows" as const, label: "Windows", icon: Monitor },
              { id: "linux" as const, label: "Linux", icon: Terminal },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer",
                    active
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(manifest?.installers[activeTab] || []).map((inst) => (
            <div
              key={inst.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono font-bold text-xs">
                    {inst.format}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {inst.arch} · {inst.sizeMB} MB
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-3">
                  {inst.label}
                </h3>
                <p className="text-[11px] font-mono text-slate-400 mt-1 truncate" title={inst.filename}>
                  {inst.filename}
                </p>
              </div>

              <a
                href={inst.url}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {inst.format}</span>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* 3. System Requirements, Installation Instructions & Release Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Release Notes (6 cols) */}
        <div className="lg:col-span-6 p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>What&apos;s New in TwoolKit Desktop v{version}</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">{releaseDate}</span>
          </div>

          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            {(manifest?.releaseNotes || []).map((note, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{note}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Installation & Security Instructions (6 cols) */}
        <div className="lg:col-span-6 p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span>Installation & System Requirements</span>
            </h3>
          </div>

          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <strong className="text-slate-900 dark:text-white block">
                macOS 12.0+ (Apple Silicon & Intel)
              </strong>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Mount the <code>.dmg</code>, drag <strong>TwoolKit.app</strong> to <strong>Applications</strong>, and open. Supports native Finder dialogs and automatic in-app updates.
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <strong className="text-slate-900 dark:text-white block">
                Windows 11 & Windows 10 (x86_64 & ARM64)
              </strong>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Run the <code>.exe</code> (NSIS) or <code>.msi</code> installer. Uses the native Microsoft Edge WebView2 runtime for minimal (~6 MB) installer footprint.
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <strong className="text-slate-900 dark:text-white block">
                Linux (Ubuntu 22.04+, Debian 12+, Fedora 39+)
              </strong>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Use <code>.AppImage</code> (`chmod +x`) for built-in atomic auto-updates, or install via <code>sudo apt install ./TwoolKit_*.deb</code> / <code>sudo dnf install ./TwoolKit-*.rpm</code>.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
