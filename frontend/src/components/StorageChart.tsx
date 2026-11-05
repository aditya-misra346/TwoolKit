"use client";

import { useMemo, useState } from "react";
import { formatBytes, BUCKET_LABEL, type StorageBucket } from "@/lib/fileTypes";
import { PieChart as PieIcon, CircleDot, BarChart3, ScanSearch, Sparkles } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

export type ChartViewMode = "donut" | "pie" | "bar";

interface StorageChartProps {
  bucketBytes: Record<StorageBucket, number>;
  bucketCounts?: Partial<Record<StorageBucket, number>>;
  totalBytes: number;
  defaultView?: ChartViewMode;
  showViewSwitcher?: boolean;
  className?: string;
}

export const BUCKET_STYLES: Record<
  StorageBucket,
  { fill: string; dot: string; text: string; bg: string; bar: string }
> = {
  documents: {
    fill: "#3b82f6",
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/50",
    bar: "bg-blue-500",
  },
  pdfs: {
    fill: "#ef4444",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/50",
    bar: "bg-red-500",
  },
  images: {
    fill: "#10b981",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
    bar: "bg-emerald-500",
  },
  presentations: {
    fill: "#f97316",
    dot: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/50",
    bar: "bg-orange-500",
  },
  videos: {
    fill: "#f59e0b",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/50",
    bar: "bg-amber-500",
  },
  audio: {
    fill: "#8b5cf6",
    dot: "bg-purple-500",
    text: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/50",
    bar: "bg-purple-500",
  },
  archives: {
    fill: "#ec4899",
    dot: "bg-pink-500",
    text: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-50 dark:bg-pink-950/50",
    bar: "bg-pink-500",
  },
  other: {
    fill: "#64748b",
    dot: "bg-slate-500",
    text: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-800/60",
    bar: "bg-slate-500",
  },
};

const BUCKET_ORDER: StorageBucket[] = [
  "documents",
  "pdfs",
  "images",
  "presentations",
  "videos",
  "audio",
  "archives",
  "other",
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

export function StorageChart({
  bucketBytes,
  bucketCounts,
  totalBytes,
  defaultView = "donut",
  showViewSwitcher = true,
  className,
}: StorageChartProps) {
  const [viewMode, setViewMode] = useState<ChartViewMode>(defaultView);
  const [hoveredBucket, setHoveredBucket] = useState<StorageBucket | null>(null);
  const [pinnedBucket, setPinnedBucket] = useState<StorageBucket | null>(null);

  const activeBucketKey = hoveredBucket ?? pinnedBucket;

  const slices = useMemo(() => {
    if (totalBytes <= 0) return [];
    let startAngle = 0;

    const items: {
      bucket: StorageBucket;
      bytes: number;
      count: number;
      pct: number;
      color: string;
      label: string;
      startAngle: number;
      endAngle: number;
      midAngle: number;
      donutPathD: string;
      piePathD: string;
    }[] = [];

    for (const b of BUCKET_ORDER) {
      const bytes = bucketBytes[b] || 0;
      const count = bucketCounts?.[b] || 0;
      if (bytes <= 0) continue;

      const pct = (bytes / totalBytes) * 100;
      // Avoid a 360-degree single arc collapsing in SVG by clamping to 359.95
      const rawAngle = (bytes / totalBytes) * 360;
      const angle = rawAngle >= 360 ? 359.95 : Math.max(rawAngle, 1.2);
      const endAngle = Math.min(360, startAngle + angle);
      const midAngle = startAngle + (endAngle - startAngle) / 2;

      const outerR = 86;
      const innerR = 59;
      const p1 = polarToCartesian(100, 100, outerR, startAngle);
      const p2 = polarToCartesian(100, 100, outerR, endAngle);
      const ip1 = polarToCartesian(100, 100, innerR, endAngle);
      const ip2 = polarToCartesian(100, 100, innerR, startAngle);

      const largeArc = endAngle - startAngle > 180 ? 1 : 0;

      const donutPathD = `M ${p1.x} ${p1.y} A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${ip1.x} ${ip1.y} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ip2.x} ${ip2.y} Z`;
      const piePathD =
        rawAngle >= 359.9
          ? `M 100 ${100 - outerR} A ${outerR} ${outerR} 0 1 1 99.9 ${100 - outerR} Z`
          : `M 100 100 L ${p1.x} ${p1.y} A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;

      items.push({
        bucket: b,
        bytes,
        count,
        pct,
        color: BUCKET_STYLES[b].fill,
        label: BUCKET_LABEL[b],
        startAngle,
        endAngle,
        midAngle,
        donutPathD,
        piePathD,
      });

      startAngle = endAngle;
    }

    return items.sort((a, b) => b.bytes - a.bytes);
  }, [bucketBytes, bucketCounts, totalBytes]);

  const activeSlice = activeBucketKey
    ? slices.find((s) => s.bucket === activeBucketKey) || null
    : null;

  const totalCount = useMemo(() => {
    if (!bucketCounts) return 0;
    return Object.values(bucketCounts).reduce((acc, v) => acc + (v || 0), 0);
  }, [bucketCounts]);

  return (
    <div className={clsx("space-y-4", className)}>
      {/* Optional View Mode Switcher */}
      {showViewSwitcher && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200 metric-number">
              {formatBytes(totalBytes)}
            </span>
            <span>analyzed</span>
            {totalCount > 0 && (
              <>
                <span>·</span>
                <span className="metric-number">{totalCount.toLocaleString()} files</span>
              </>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Storage chart view"
            className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70 text-[11px]"
          >
            {[
              { id: "donut" as const, label: "Donut", icon: CircleDot },
              { id: "pie" as const, label: "Pie", icon: PieIcon },
              { id: "bar" as const, label: "Bar", icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setViewMode(tab.id)}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                    active
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {totalBytes === 0 ? (
        <div className="py-6 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeDasharray="6 4"
                  className="text-slate-200 dark:text-slate-800"
                />
              </svg>
              <ScanSearch className="w-6 h-6 text-blue-500 absolute" />
            </div>
            <div className="space-y-1">
              <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                No storage scan recorded in this session
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                Drop any files or folders into the File Scanner to visualize real-time category distribution across Documents, PDFs, Images, Presentations, Videos, Audio, and Archives.
              </p>
            </div>
          </div>
          <Link
            href="/scanner"
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            <ScanSearch className="w-3.5 h-3.5" />
            <span>Scan Files Now</span>
          </Link>
        </div>
      ) : viewMode === "bar" ? (
        /* BAR CHART VIEW */
        <div className="space-y-4">
          {/* Stacked Composition Ribbon */}
          <div className="space-y-1.5">
            <div className="h-3.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex p-0.5 gap-0.5">
              {slices.map((s) => {
                const isSelected = activeBucketKey === s.bucket;
                return (
                  <div
                    key={s.bucket}
                    onMouseEnter={() => setHoveredBucket(s.bucket)}
                    onMouseLeave={() => setHoveredBucket(null)}
                    onClick={() =>
                      setPinnedBucket((prev) => (prev === s.bucket ? null : s.bucket))
                    }
                    style={{
                      width: `${Math.max(s.pct, 1.5)}%`,
                      backgroundColor: s.color,
                    }}
                    className={clsx(
                      "h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 cursor-pointer",
                      activeBucketKey && !isSelected ? "opacity-40" : "opacity-100"
                    )}
                    title={`${s.label}: ${formatBytes(s.bytes)} (${s.pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
          </div>

          {/* Horizontal Category Bars */}
          <div className="space-y-2.5">
            {slices.map((slice) => {
              const isHighlighted = activeBucketKey === slice.bucket;
              const style = BUCKET_STYLES[slice.bucket];
              return (
                <div
                  key={slice.bucket}
                  onMouseEnter={() => setHoveredBucket(slice.bucket)}
                  onMouseLeave={() => setHoveredBucket(null)}
                  onClick={() =>
                    setPinnedBucket((prev) => (prev === slice.bucket ? null : slice.bucket))
                  }
                  className={clsx(
                    "p-2.5 rounded-xl border transition-all cursor-pointer",
                    isHighlighted
                      ? "bg-slate-50 dark:bg-slate-800/80 border-blue-400/60 dark:border-blue-500/60 shadow-2xs"
                      : "bg-white dark:bg-slate-900/50 border-slate-200/70 dark:border-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700"
                  )}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={clsx("w-2.5 h-2.5 rounded-full shrink-0", style.dot)} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {slice.label}
                      </span>
                      {slice.count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                          {slice.count} {slice.count === 1 ? "file" : "files"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatBytes(slice.bytes)}
                      </span>
                      <span className="text-[11px] text-slate-400 w-12 text-right">
                        {slice.pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(slice.pct, 2)}%`,
                        backgroundColor: slice.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* DONUT & PIE CHART VIEW */
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          {/* Interactive SVG Donut or Pie */}
          <div className="relative w-48 h-48 sm:w-52 sm:h-52 shrink-0 select-none">
            <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
              {slices.map((slice) => {
                const isSelected = activeBucketKey === slice.bucket;
                const midRad = ((slice.midAngle - 90) * Math.PI) / 180;
                const pullDistance = isSelected ? 5 : 0;
                const tx = Math.cos(midRad) * pullDistance;
                const ty = Math.sin(midRad) * pullDistance;

                return (
                  <path
                    key={slice.bucket}
                    d={viewMode === "donut" ? slice.donutPathD : slice.piePathD}
                    fill={slice.color}
                    stroke={viewMode === "pie" ? "var(--card)" : "transparent"}
                    strokeWidth={viewMode === "pie" ? 2 : 0}
                    className="transition-all duration-200 cursor-pointer"
                    style={{
                      transformOrigin: "100px 100px",
                      transform: `translate(${tx}px, ${ty}px) scale(${isSelected ? 1.03 : 1})`,
                      opacity: activeBucketKey && !isSelected ? 0.55 : 1,
                    }}
                    onMouseEnter={() => setHoveredBucket(slice.bucket)}
                    onMouseLeave={() => setHoveredBucket(null)}
                    onClick={() =>
                      setPinnedBucket((prev) => (prev === slice.bucket ? null : slice.bucket))
                    }
                  />
                );
              })}
            </svg>

            {/* Center Metric Badge for Donut Mode, or Floating Pill for Pie Mode */}
            {viewMode === "donut" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                {activeSlice ? (
                  <>
                    <span className="text-2xs uppercase font-bold text-slate-300 truncate max-w-[110px]">
                      {activeSlice.label}
                    </span>
                    <span className="text-lg sm:text-xl font-black text-white tracking-tight leading-none mt-1 metric-number">
                      {activeSlice.pct.toFixed(1)}%
                    </span>
                    <span className="text-2xs text-slate-300 font-mono mt-1">
                      {formatBytes(activeSlice.bytes)}
                    </span>
                    {activeSlice.count > 0 && (
                      <span className="text-2xs text-slate-400 mt-0.5">
                        {activeSlice.count} {activeSlice.count === 1 ? "file" : "files"}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-2xs uppercase font-bold text-slate-300 tracking-wider">
                      Total Used
                    </span>
                    <span className="text-base sm:text-lg font-black text-white tracking-tight leading-none mt-1 metric-number">
                      {formatBytes(totalBytes)}
                    </span>
                    <span className="text-2xs text-slate-300 mt-1">
                      {slices.length} {slices.length === 1 ? "Category" : "Categories"}
                    </span>
                  </>
                )}
              </div>
            ) : (
              activeSlice && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-slate-900/95 text-white text-xs font-medium shadow-lg whitespace-nowrap pointer-events-none border border-slate-700">
                  <span className="font-bold">{activeSlice.label}:</span>{" "}
                  <span className="font-mono">{formatBytes(activeSlice.bytes)}</span> (
                  {activeSlice.pct.toFixed(1)}%)
                </div>
              )
            )}
          </div>

          {/* Interactive Legend & Category Breakdown Grid */}
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm">
            {slices.map((slice) => {
              const isHighlighted = activeBucketKey === slice.bucket;
              const style = BUCKET_STYLES[slice.bucket];
              return (
                <div
                  key={slice.bucket}
                  onMouseEnter={() => setHoveredBucket(slice.bucket)}
                  onMouseLeave={() => setHoveredBucket(null)}
                  onClick={() =>
                    setPinnedBucket((prev) => (prev === slice.bucket ? null : slice.bucket))
                  }
                  className={clsx(
                    "p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5",
                    isHighlighted
                      ? "bg-slate-800 border-blue-500 scale-[1.01] shadow-2xs"
                      : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={clsx("w-3 h-3 rounded-full shrink-0", style.dot)} />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100 truncate">
                        {slice.label}
                      </div>
                      {slice.count > 0 && (
                        <div className="text-2xs text-slate-300">
                          {slice.count} {slice.count === 1 ? "file" : "files"}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-white font-mono text-xs metric-number">
                      {formatBytes(slice.bytes)}
                    </div>
                    <div className="text-2xs text-slate-300 font-mono">
                      {slice.pct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
