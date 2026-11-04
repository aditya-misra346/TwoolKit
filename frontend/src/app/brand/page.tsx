"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import {
  Download,
  Copy,
  Check,
  Sparkles,
  Layers,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Eye,
  Sliders,
  Maximize2,
  FileText,
  FileCode,
  Laptop,
  Moon,
  Sun,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

interface ColorItem {
  name: string;
  role: string;
  hex: string;
  rgb: string;
  bgClass: string;
  textClass: string;
}

const BRAND_COLORS: ColorItem[] = [
  {
    name: "Electric Cyan",
    role: "Top-Wing Light Source & Highlight",
    hex: "#38BDF8",
    rgb: "56, 189, 248",
    bgClass: "bg-[#38BDF8]",
    textClass: "text-[#38BDF8]",
  },
  {
    name: "Kinetic Teal",
    role: "Arrowhead Apex & Kinetic Focal Point",
    hex: "#06B6D4",
    rgb: "6, 182, 212",
    bgClass: "bg-[#06B6D4]",
    textClass: "text-[#06B6D4]",
  },
  {
    name: "Cobalt Core",
    role: "Core Brand Blue & Primary Interaction",
    hex: "#2563EB",
    rgb: "37, 99, 235",
    bgClass: "bg-[#2563EB]",
    textClass: "text-[#2563EB]",
  },
  {
    name: "Deep Royal",
    role: "Stem Pillar Anchor & Gradient Base",
    hex: "#1D4ED8",
    rgb: "29, 78, 216",
    bgClass: "bg-[#1D4ED8]",
    textClass: "text-[#1D4ED8]",
  },
  {
    name: "Obsidian Midnight",
    role: "Primary Dark Canvas & Icon Background",
    hex: "#0B0F19",
    rgb: "11, 15, 25",
    bgClass: "bg-[#0B0F19]",
    textClass: "text-[#0B0F19]",
  },
  {
    name: "Pure White",
    role: "Wordmark Typography & High Contrast",
    hex: "#FFFFFF",
    rgb: "255, 255, 255",
    bgClass: "bg-white",
    textClass: "text-white",
  },
];

const ASSET_DOWNLOADS = [
  { name: "Raw Symbol (Vector SVG)", file: "/brand/symbol.svg", format: "SVG", size: "32 × 32 (Scalable)" },
  { name: "App Icon Squircle Dark", file: "/brand/icon-dark.svg", format: "SVG", size: "128 × 128 (Scalable)" },
  { name: "App Icon Squircle Light", file: "/brand/icon-light.svg", format: "SVG", size: "128 × 128 (Scalable)" },
  { name: "Full Horizontal Logo Dark", file: "/brand/logo-dark.svg", format: "SVG", size: "180 × 40 (Scalable)" },
  { name: "Full Horizontal Logo Light", file: "/brand/logo-light.svg", format: "SVG", size: "180 × 40 (Scalable)" },
  { name: "Monochrome White Symbol", file: "/brand/symbol-mono-white.svg", format: "SVG", size: "32 × 32" },
  { name: "Monochrome Black Symbol", file: "/brand/symbol-mono-black.svg", format: "SVG", size: "32 × 32" },
  { name: "HD App Icon (512px PNG)", file: "/brand/icon-512.png", format: "PNG", size: "512 × 512 px" },
  { name: "Apple Touch Icon", file: "/brand/apple-touch-icon.png", format: "PNG", size: "180 × 180 px" },
  { name: "Multi-Resolution Favicon", file: "/favicon.ico", format: "ICO", size: "16, 32, 48 px" },
];

export default function BrandPage() {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<"dark" | "light" | "navy">("dark");

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedHex(text);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  return (
    <div className="space-y-12 max-w-6xl mx-auto animate-in fade-in duration-200 pb-16">
      {/* 1. Executive Brand Header */}
      <div className="border-b border-slate-200/80 dark:border-slate-800/80 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Official Brand Identity & Design System</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            TWOOLKIT Brand Architecture
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
            The visual language of TWOOLKIT represents precision, speed, modularity, and seamless transformation across the global digital media ecosystem.
          </p>
        </div>

        {/* Live Canvas Background Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 self-start">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2.5">
            Preview Surface:
          </span>
          <button
            onClick={() => setPreviewTheme("dark")}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              previewTheme === "dark"
                ? "bg-slate-950 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            )}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Dark</span>
          </button>
          <button
            onClick={() => setPreviewTheme("navy")}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              previewTheme === "navy"
                ? "bg-[#0B0F19] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            )}
          >
            <span className="w-3 h-3 rounded-full bg-[#0B0F19] border border-blue-500/40" />
            <span>Midnight</span>
          </button>
          <button
            onClick={() => setPreviewTheme("light")}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              previewTheme === "light"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            )}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Light</span>
          </button>
        </div>
      </div>

      {/* 2. Master Symbol & Core Concept Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Large Interactive Master Display (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div
            className={clsx(
              "w-full aspect-square max-w-sm rounded-3xl p-10 flex flex-col items-center justify-center border transition-all duration-300 relative shadow-2xl overflow-hidden group",
              previewTheme === "dark" && "bg-slate-950 border-slate-800 shadow-blue-950/20",
              previewTheme === "navy" && "bg-[#0B0F19] border-blue-950/60 shadow-blue-950/40",
              previewTheme === "light" && "bg-slate-50 border-slate-200 shadow-slate-200"
            )}
          >
            {/* Subtle Grid in Background */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
            />

            <div className="relative z-10 scale-125 transform group-hover:scale-135 transition-transform duration-300">
              <Logo
                variant="icon"
                size="xl"
                theme={previewTheme === "light" ? "light" : "dark"}
              />
            </div>

            <div className="absolute bottom-4 left-0 right-0 text-center">
              <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500">
                The "T-Nexus" Dual-Facet Monogram
              </span>
            </div>
          </div>
        </div>

        {/* Narrative & Conceptual Anatomy (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Concept & Silhouette
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              The Geometry of Digital Transformation
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              The symbol communicates the platform's core identity through two precision geometric planes interacting along a calibrated 45-degree conversion channel:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5 shadow-2xs">
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span>1. Upper Transverse Wing</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Represents input standards, stability, structural integrity, and format consistency across documents and media.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5 shadow-2xs">
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                <span>2. Lower Kinetic Pillar</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                An upward arrowhead evoking speed, compression, optimization, and real-time processing elevation.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5 shadow-2xs">
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span>3. 45° Optical Slit</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Represents the universal angle of a turning page, a folded document corner, and the forward slash of digital file hierarchies.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5 shadow-2xs">
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span>4. Quadratic Micro-Radii</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                G2-continuous curves prevent pixel clipping at 16×16px while providing a refined tactile aerospace aesthetic.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Complete Logo Family Variations */}
      <div className="space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Logo Family
          </span>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            Official Brand Variations
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Consistent geometric construction adapted for diverse physical and digital surfaces.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Variation A: Primary Full Horizontal (Dark) */}
          <div className="p-6 rounded-2xl bg-[#0B0F19] border border-slate-800 shadow-md flex flex-col justify-between space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400">
                Primary Full · Dark Mode
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                Web Header
              </span>
            </div>
            <div className="py-6 flex items-center justify-center">
              <Logo variant="full" size="lg" theme="dark" />
            </div>
            <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
              Standard horizontal brand presentation with symbol, wordmark, and workspace descriptor.
            </div>
          </div>

          {/* Variation B: Primary Full Horizontal (Light) */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md flex flex-col justify-between space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-500">
                Primary Full · Light Mode
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                Light Surface
              </span>
            </div>
            <div className="py-6 flex items-center justify-center">
              <Logo variant="full" size="lg" theme="light" />
            </div>
            <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
              Optimized for white document backgrounds, printable exports, and light theme layouts.
            </div>
          </div>

          {/* Variation C: Compact Navigation Lockup */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-md flex flex-col justify-between space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400">
                Compact Lockup
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                Mobile & Sidebar
              </span>
            </div>
            <div className="py-6 flex items-center justify-center">
              <Logo variant="compact" size="md" theme="dark" />
            </div>
            <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
              Streamlined symbol + wordmark without secondary descriptor for dense UI headers.
            </div>
          </div>

          {/* Variation D: App Icon Squircle */}
          <div className="p-6 rounded-2xl bg-[#090D16] border border-slate-800 shadow-md flex flex-col justify-between space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400">
                App Icon · Squircle
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                Desktop / Dock
              </span>
            </div>
            <div className="py-6 flex items-center justify-center">
              <Logo variant="icon" size="xl" theme="dark" />
            </div>
            <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
              Enclosed in an obsidian squircle with border glow for macOS, Windows, and PWA apps.
            </div>
          </div>

          {/* Variation E: Monochrome Pure White */}
          <div className="p-6 rounded-2xl bg-black border border-slate-800 shadow-md flex flex-col justify-between space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400">
                Monochrome White
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                100% #FFFFFF
              </span>
            </div>
            <div className="py-6 flex items-center justify-center">
              <Logo variant="full" size="md" theme="monochrome" className="text-white" />
            </div>
            <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
              Zero color dependence: relies purely on the 45° negative space slit for silhouette recognition.
            </div>
          </div>

          {/* Variation F: Monochrome Pure Black */}
          <div className="p-6 rounded-2xl bg-slate-100 border border-slate-300 shadow-md flex flex-col justify-between space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-600">
                Monochrome Black
              </span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                100% #0F172A
              </span>
            </div>
            <div className="py-6 flex items-center justify-center">
              <Logo variant="full" size="md" theme="monochrome" className="text-slate-950" />
            </div>
            <div className="text-[11px] text-slate-500 border-t border-slate-200 pt-3">
              High-contrast single-color treatment for print, physical stamping, and legal documents.
            </div>
          </div>
        </div>
      </div>

      {/* 4. Scalability & Icon Fidelity Grid */}
      <div className="space-y-6 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Extreme Scalability
          </span>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            Icon Fidelity at All Display Resolutions
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tested across real browser pixel rasters. The 2.5-unit negative gap maintains optical clarity from 16px to 512px.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 pt-4">
          {[
            { size: "16 px", desc: "Favicon / Tab", iconSize: "w-4 h-4", padding: "p-2" },
            { size: "32 px", desc: "Bookmark Bar", iconSize: "w-8 h-8", padding: "p-3" },
            { size: "48 px", desc: "Taskbar / Dock", iconSize: "w-12 h-12", padding: "p-3" },
            { size: "64 px", desc: "Desktop Shortcut", iconSize: "w-16 h-16", padding: "p-4" },
            { size: "128 px", desc: "App Manifest", iconSize: "w-20 h-20", padding: "p-4" },
            { size: "256 px", desc: "macOS Launchpad", iconSize: "w-24 h-24", padding: "p-4" },
            { size: "512 px", desc: "HD Splash Screen", iconSize: "w-28 h-28", padding: "p-4" },
          ].map((item, i) => (
            <div
              key={i}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/70 flex flex-col items-center justify-between text-center space-y-3"
            >
              <div className="text-[10px] font-mono font-bold text-slate-400">{item.size}</div>
              <div className="flex items-center justify-center my-auto">
                <div className={clsx(item.iconSize, "shrink-0")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/brand/icon-dark.svg"
                    alt={`TWOOLKIT Icon ${item.size}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
              <div className="text-[9px] text-slate-500 font-medium">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Brand Color Palette System */}
      <div className="space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Color Identity
          </span>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            Precision Palette Specifications
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Click any color card to instantly copy the hexadecimal value to your clipboard.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BRAND_COLORS.map((c) => (
            <div
              key={c.hex}
              onClick={() => copyToClipboard(c.hex)}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500 transition-all cursor-pointer shadow-2xs group flex items-start gap-3.5"
            >
              <div
                className={clsx(
                  "w-12 h-12 rounded-xl shadow-xs shrink-0 border border-black/10 group-hover:scale-105 transition-transform",
                  c.bgClass
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 dark:text-white truncate">
                    {c.name}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 group-hover:text-blue-500 transition-colors">
                    {copiedHex === c.hex ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHex === c.hex ? "Copied" : c.hex}</span>
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">{c.role}</div>
                <div className="text-[9px] font-mono text-slate-500 mt-1">RGB({c.rgb})</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Download Center */}
      <div className="space-y-6 p-6 sm:p-8 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <Download className="w-5 h-5 text-blue-400" />
              Production Asset Download Center
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Download clean vector SVGs, multi-resolution PNGs, and Windows ICO files for development and marketing.
            </p>
          </div>
          <a
            href="/brand/icon-512.png"
            download="twoolkit-icon-512.png"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors flex items-center gap-2 self-start cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Download Master Kit (HD)</span>
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
          {ASSET_DOWNLOADS.map((item, i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-950/60 text-blue-400 flex items-center justify-center font-mono text-[10px] font-bold shrink-0 border border-blue-900/60">
                  {item.format}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">{item.size}</div>
                </div>
              </div>

              <a
                href={item.file}
                download
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                title={`Download ${item.name}`}
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Return to Dashboard Link */}
      <div className="pt-4 flex items-center justify-between border-t border-slate-200/80 dark:border-slate-800/80">
        <Link
          href="/"
          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
        >
          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          <span>Return to Workspace Dashboard</span>
        </Link>
        <span className="text-xs text-slate-400">
          TWOOLKIT Brand Guidelines v1.0
        </span>
      </div>
    </div>
  );
}
