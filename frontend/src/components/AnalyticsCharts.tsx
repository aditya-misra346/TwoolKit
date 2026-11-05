"use client";

import { useMemo, useState } from "react";
import { formatBytes, formatDate, CATEGORY_COLOR, type Category } from "@/lib/fileTypes";
import type { ScannedFile } from "@/lib/scanner";
import type { Activity, Stats } from "@/stores/history";
import {
  BarChart3,
  FileText,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  FolderTree,
  Layers,
  Minimize2,
  RefreshCw,
  PieChart,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

const EXTENSION_PALETTE = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // emerald
  "#f97316", // orange
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#eab308", // amber
  "#06b6d4", // cyan
  "#64748b", // slate
];

/* ============================================================================
 * 1. LARGEST FILES HORIZONTAL BAR CHART
 * ========================================================================== */
interface LargestFilesBarChartProps {
  files: ScannedFile[];
  totalBytes: number;
  limit?: number;
}

export function LargestFilesBarChart({
  files,
  totalBytes,
  limit = 7,
}: LargestFilesBarChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const topFiles = useMemo(() => {
    return [...files]
      .sort((a, b) => b.size - a.size)
      .slice(0, limit);
  }, [files, limit]);

  const maxFileBytes = topFiles.length > 0 ? topFiles[0].size : 1;

  if (topFiles.length === 0) {
    return (
      <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30">
        <BarChart3 className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          No scanned files to rank yet
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Scan a folder or drop files to compare your largest storage consumers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {topFiles.map((file, idx) => {
        const pctOfMax = maxFileBytes > 0 ? (file.size / maxFileBytes) * 100 : 0;
        const pctOfTotal = totalBytes > 0 ? (file.size / totalBytes) * 100 : 0;
        const isHovered = hoveredId === file.id;
        const ext = (file.extension || file.category || "file").toUpperCase();

        return (
          <div
            key={file.id}
            onMouseEnter={() => setHoveredId(file.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={clsx(
              "p-2.5 rounded-xl border transition-all",
              isHovered
                ? "bg-slate-50 dark:bg-slate-800/80 border-blue-400/60 dark:border-blue-500/60 shadow-2xs"
                : "bg-white dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/70"
            )}
          >
            <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 font-mono">
                  #{idx + 1}
                </span>
                <span
                  className="font-semibold text-slate-800 dark:text-slate-200 truncate"
                  title={file.path}
                >
                  {file.name}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 shrink-0 font-mono">
                  {ext}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                <span className="font-bold text-slate-900 dark:text-white text-xs metric-number">
                  {formatBytes(file.size)}
                </span>
                <span className="text-[10px] text-slate-400 w-11 text-right">
                  {pctOfTotal.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Animated horizontal bar */}
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-500 dark:to-indigo-400"
                style={{ width: `${Math.max(pctOfMax, 3)}%` }}
              />
            </div>

            {isHovered && (
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 font-mono animate-in fade-in duration-100">
                <span className="truncate max-w-[70%]">{file.path}</span>
                <span>Modified {formatDate(file.lastModified)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * 2. FILE FORMAT / EXTENSION DISTRIBUTION CHART
 * ========================================================================== */
interface FormatDistributionChartProps {
  files: ScannedFile[];
  totalBytes: number;
}

export function FormatDistributionChart({
  files,
  totalBytes,
}: FormatDistributionChartProps) {
  const [view, setView] = useState<"bars" | "donut">("bars");
  const [hoveredExt, setHoveredExt] = useState<string | null>(null);

  const items = useMemo(() => {
    if (files.length === 0) return [];
    const map = new Map<string, { ext: string; count: number; bytes: number }>();

    for (const f of files) {
      const ext = (f.extension || "other").toLowerCase();
      const cur = map.get(ext) || { ext, count: 0, bytes: 0 };
      cur.count += 1;
      cur.bytes += f.size;
      map.set(ext, cur);
    }

    const sorted = Array.from(map.values()).sort((a, b) => b.bytes - a.bytes);
    const top = sorted.slice(0, 7);
    const rest = sorted.slice(7);

    if (rest.length > 0) {
      top.push({
        ext: "other",
        count: rest.reduce((a, r) => a + r.count, 0),
        bytes: rest.reduce((a, r) => a + r.bytes, 0),
      });
    }

    let startAngle = 0;
    return top.map((item, idx) => {
      const pctBytes = totalBytes > 0 ? (item.bytes / totalBytes) * 100 : (item.count / files.length) * 100;
      const pctCount = (item.count / files.length) * 100;
      const color = EXTENSION_PALETTE[idx % EXTENSION_PALETTE.length];

      const rawAngle = (pctBytes / 100) * 360;
      const angle = rawAngle >= 360 ? 359.9 : Math.max(rawAngle, 2);
      const endAngle = Math.min(360, startAngle + angle);

      const r = 74;
      const ir = 48;
      const rad1 = ((startAngle - 90) * Math.PI) / 180;
      const rad2 = ((endAngle - 90) * Math.PI) / 180;
      const x1 = 90 + r * Math.cos(rad1);
      const y1 = 90 + r * Math.sin(rad1);
      const x2 = 90 + r * Math.cos(rad2);
      const y2 = 90 + r * Math.sin(rad2);
      const ix1 = 90 + ir * Math.cos(rad2);
      const iy1 = 90 + ir * Math.sin(rad2);
      const ix2 = 90 + ir * Math.cos(rad1);
      const iy2 = 90 + ir * Math.sin(rad1);
      const largeArc = endAngle - startAngle > 180 ? 1 : 0;
      const pathD = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;

      startAngle = endAngle;

      return {
        ...item,
        label: `.${item.ext.toUpperCase()}`,
        pctBytes,
        pctCount,
        color,
        pathD,
      };
    });
  }, [files, totalBytes]);

  if (items.length === 0) {
    return (
      <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30">
        <PieChart className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          No format distribution data yet
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Scan files to inspect the exact breakdown of extensions (.PDF, .DOCX, .PNG, .PPTX, etc.).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-400">
          {items.length} distinct format groups across {files.length} files
        </span>
        <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold">
          <button
            type="button"
            onClick={() => setView("bars")}
            className={clsx(
              "px-2 py-0.5 rounded-md cursor-pointer transition-colors",
              view === "bars"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                : "text-slate-500"
            )}
          >
            Bars
          </button>
          <button
            type="button"
            onClick={() => setView("donut")}
            className={clsx(
              "px-2 py-0.5 rounded-md cursor-pointer transition-colors",
              view === "donut"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                : "text-slate-500"
            )}
          >
            Donut
          </button>
        </div>
      </div>

      {view === "bars" ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.ext}
              onMouseEnter={() => setHoveredExt(item.ext)}
              onMouseLeave={() => setHoveredExt(null)}
              className="p-2 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {item.count} {item.count === 1 ? "file" : "files"} ({item.pctCount.toFixed(0)}%)
                  </span>
                </div>
                <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {formatBytes(item.bytes)}{" "}
                  <span className="text-[10px] text-slate-400">({item.pctBytes.toFixed(1)}%)</span>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(item.pctBytes, 2.5)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-5 py-2">
          <div className="relative w-44 h-44 shrink-0">
            <svg viewBox="0 0 180 180" className="w-full h-full">
              {items.map((item) => (
                <path
                  key={item.ext}
                  d={item.pathD}
                  fill={item.color}
                  className="transition-all duration-200 cursor-pointer"
                  style={{
                    transformOrigin: "90px 90px",
                    transform: hoveredExt === item.ext ? "scale(1.04)" : "scale(1)",
                  }}
                  onMouseEnter={() => setHoveredExt(item.ext)}
                  onMouseLeave={() => setHoveredExt(null)}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3">
              <span className="text-2xs font-bold uppercase text-slate-300">
                {hoveredExt ? `.${hoveredExt.toUpperCase()}` : "Formats"}
              </span>
              <span className="text-sm sm:text-base font-black text-white">
                {hoveredExt
                  ? `${items.find((i) => i.ext === hoveredExt)?.count || 0} files`
                  : `${items.length} types`}
              </span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-2.5 w-full text-xs">
            {items.map((item) => (
              <div
                key={item.ext}
                onMouseEnter={() => setHoveredExt(item.ext)}
                onMouseLeave={() => setHoveredExt(null)}
                className="p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-mono font-bold text-slate-100 truncate">
                    {item.label}
                  </span>
                </div>
                <span className="text-2xs font-mono text-slate-300 shrink-0">
                  {item.count} ({item.pctBytes.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 3. FILE ACTIVITY OVER TIME (AREA / BAR CHART)
 * ========================================================================== */
interface ActivityTrendChartProps {
  activities: Activity[];
}

export function ActivityTrendChart({ activities }: ActivityTrendChartProps) {
  const [filterKind, setFilterKind] = useState<"all" | "convert" | "compress" | "pdf">("all");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Bucket real activities into the last 7 days (including today)
  const buckets = useMemo(() => {
    const now = new Date();
    const days: {
      dateKey: string;
      label: string;
      shortDay: string;
      totalOps: number;
      filesCount: number;
      bytesProcessed: number;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      const shortDay = d.toLocaleDateString(undefined, { weekday: "short" });
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      days.push({
        dateKey,
        label,
        shortDay,
        totalOps: 0,
        filesCount: 0,
        bytesProcessed: 0,
      });
    }

    const filtered = activities.filter((a) => {
      if (filterKind === "all") return true;
      if (filterKind === "convert") return a.kind === "convert";
      if (filterKind === "compress") return a.kind === "compress";
      if (filterKind === "pdf") return a.kind === "pdf" || a.kind === "ocr";
      return true;
    });

    for (const act of filtered) {
      const d = new Date(act.ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      const slot = days.find((day) => day.dateKey === key);
      if (slot) {
        slot.totalOps += 1;
        slot.filesCount += act.files || 1;
        slot.bytesProcessed += act.bytesIn || 0;
      }
    }

    return days;
  }, [activities, filterKind]);

  const maxFiles = Math.max(...buckets.map((b) => b.filesCount), 1);
  const totalWindowFiles = buckets.reduce((a, b) => a + b.filesCount, 0);

  // SVG coordinates for smooth area/line curve across 7 points
  const width = 420;
  const height = 130;
  const padX = 24;
  const padY = 18;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const points = buckets.map((b, i) => {
    const x = padX + (i / (buckets.length - 1)) * plotW;
    const y = padY + plotH - (b.filesCount / maxFiles) * plotH;
    return { x, y, ...b };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(
    padY + plotH
  ).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padY + plotH).toFixed(1)} Z`;

  return (
    <div className="space-y-3">
      {/* Filter Pills */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-bold text-slate-900 dark:text-white metric-number">
            {totalWindowFiles}
          </span>{" "}
          files processed in the last 7 days
        </div>

        <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold">
          {[
            { id: "all", label: "All" },
            { id: "convert", label: "Conversions" },
            { id: "compress", label: "Compressions" },
            { id: "pdf", label: "PDF Ops" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterKind(tab.id as any)}
              className={clsx(
                "px-2 py-0.5 rounded-md cursor-pointer transition-colors",
                filterKind === tab.id
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Area & Point Chart */}
      <div className="relative pt-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible">
          <defs>
            <linearGradient id="activityAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal baseline grid */}
          {[0, 0.5, 1].map((ratio, idx) => {
            const y = padY + ratio * plotH;
            return (
              <line
                key={idx}
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="currentColor"
                strokeDasharray="3 3"
                className="text-slate-200 dark:text-slate-800"
                strokeWidth="1"
              />
            );
          })}

          {/* Area Fill */}
          <path d={areaPath} fill="url(#activityAreaGrad)" />

          {/* Trend Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points & Labels */}
          {points.map((pt, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <g
                key={pt.dateKey}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5.5 : 3.5}
                  fill={isHovered ? "#2563eb" : "#3b82f6"}
                  stroke="var(--card)"
                  strokeWidth="2"
                />
                <text
                  x={pt.x}
                  y={height - 1}
                  textAnchor="middle"
                  className="fill-slate-300 text-[11px] font-semibold select-none"
                >
                  {pt.shortDay}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip on hover */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <div className="mt-1 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-[11px] flex items-center justify-between">
            <span className="font-semibold">{points[hoveredIdx].label}</span>
            <span className="font-mono">
              {points[hoveredIdx].filesCount} files · {points[hoveredIdx].totalOps} jobs ·{" "}
              {formatBytes(points[hoveredIdx].bytesProcessed)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * 4. PROCESSING ANALYTICS & JOB HEALTH SUMMARY
 * ========================================================================== */
interface ProcessingStatusChartProps {
  stats: Stats;
  activeTasks: number;
}

export function ProcessingStatusChart({
  stats,
  activeTasks,
}: ProcessingStatusChartProps) {
  const totalJobs = stats.tasksCompleted + stats.tasksFailed + activeTasks;
  const successRate =
    stats.tasksCompleted + stats.tasksFailed > 0
      ? Math.round((stats.tasksCompleted / (stats.tasksCompleted + stats.tasksFailed)) * 100)
      : 100;

  const metrics = [
    {
      label: "Successful Jobs",
      value: stats.tasksCompleted,
      color: "bg-emerald-500",
      badge: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60",
    },
    {
      label: "Completed Conversions",
      value: stats.filesConverted,
      color: "bg-blue-500",
      badge: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60",
    },
    {
      label: "Compressed Files",
      value: stats.filesCompressed,
      color: "bg-purple-500",
      badge: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60",
    },
    {
      label: "PDF & OCR Operations",
      value: stats.pdfOperations + stats.ocrPages,
      color: "bg-orange-500",
      badge: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60",
    },
    {
      label: "Failed / Aborted Jobs",
      value: stats.tasksFailed,
      color: "bg-rose-500",
      badge: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60",
    },
  ];

  const maxVal = Math.max(...metrics.map((m) => m.value), 1);

  return (
    <div className="space-y-4">
      {/* Top summary banner */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            Success Rate
          </span>
          <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 metric-number">
            {successRate}%
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            Bytes Processed
          </span>
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white metric-number">
            {formatBytes(stats.bytesProcessed)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            Bytes Saved
          </span>
          <span className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400 metric-number">
            {formatBytes(stats.bytesSavedByCompression)}
          </span>
        </div>
      </div>

      {/* Horizontal metric bars */}
      <div className="space-y-2">
        {metrics.map((m) => {
          const pct = totalJobs > 0 ? (m.value / maxVal) * 100 : 0;
          return (
            <div key={m.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {m.label}
                </span>
                <span
                  className={clsx(
                    "px-2 py-0.5 rounded-md font-mono font-bold text-[11px] metric-number",
                    m.badge
                  )}
                >
                  {m.value.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={clsx("h-full rounded-full transition-all duration-500", m.color)}
                  style={{ width: `${m.value > 0 ? Math.max(pct, 4) : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
 * 5. STORAGE BY DIRECTORY / FOLDER HORIZONTAL BAR CHART
 * ========================================================================== */
interface FolderStorageBarChartProps {
  files: ScannedFile[];
  totalBytes: number;
}

export function FolderStorageBarChart({
  files,
  totalBytes,
}: FolderStorageBarChartProps) {
  const folders = useMemo(() => {
    if (files.length === 0) return [];
    const map = new Map<string, { folder: string; bytes: number; count: number }>();

    for (const f of files) {
      const parts = f.path.split("/");
      const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "Root Workspace";
      const cur = map.get(folder) || { folder, bytes: 0, count: 0 };
      cur.bytes += f.size;
      cur.count += 1;
      map.set(folder, cur);
    }

    return Array.from(map.values())
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8);
  }, [files]);

  if (folders.length === 0) {
    return (
      <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30">
        <FolderTree className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          No directory hierarchy scanned yet
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Scan a folder to inspect storage consumption by subdirectory.
        </p>
      </div>
    );
  }

  const maxFolderBytes = folders[0]?.bytes || 1;

  return (
    <div className="space-y-2.5">
      {folders.map((dir) => {
        const pctTotal = totalBytes > 0 ? (dir.bytes / totalBytes) * 100 : 0;
        const pctBar = (dir.bytes / maxFolderBytes) * 100;
        return (
          <div
            key={dir.folder}
            className="p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900/40"
          >
            <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <FolderTree className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {dir.folder}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  ({dir.count} {dir.count === 1 ? "file" : "files"})
                </span>
              </div>
              <div className="font-mono text-xs shrink-0">
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatBytes(dir.bytes)}
                </span>
                <span className="text-[10px] text-slate-400 ml-1.5">
                  ({pctTotal.toFixed(1)}%)
                </span>
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${Math.max(pctBar, 3)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
