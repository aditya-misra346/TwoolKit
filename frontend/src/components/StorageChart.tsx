"use client";

import { useMemo, useState } from "react";
import { formatBytes, BUCKET_LABEL, type StorageBucket } from "@/lib/fileTypes";
import clsx from "clsx";

interface StorageChartProps {
  bucketBytes: Record<StorageBucket, number>;
  totalBytes: number;
  className?: string;
}

const BUCKET_COLORS: Record<StorageBucket, { fill: string; dot: string; text: string }> = {
  documents: { fill: "#3b82f6", dot: "bg-blue-500", text: "text-blue-500" },
  images: { fill: "#10b981", dot: "bg-emerald-500", text: "text-emerald-500" },
  presentations: { fill: "#f97316", dot: "bg-orange-500", text: "text-orange-500" },
  videos: { fill: "#f59e0b", dot: "bg-amber-500", text: "text-amber-500" },
  audio: { fill: "#8b5cf6", dot: "bg-purple-500", text: "text-purple-500" },
  archives: { fill: "#ec4899", dot: "bg-pink-500", text: "text-pink-500" },
  other: { fill: "#64748b", dot: "bg-slate-500", text: "text-slate-500" },
};

export function StorageChart({ bucketBytes, totalBytes, className }: StorageChartProps) {
  const [hoveredBucket, setHoveredBucket] = useState<StorageBucket | null>(null);

  const slices = useMemo(() => {
    if (totalBytes === 0) return [];
    let startAngle = 0;
    const items: {
      bucket: StorageBucket;
      bytes: number;
      pct: number;
      color: string;
      label: string;
      startAngle: number;
      endAngle: number;
      pathD: string;
    }[] = [];

    const order: StorageBucket[] = [
      "documents",
      "images",
      "presentations",
      "videos",
      "audio",
      "archives",
      "other",
    ];

    for (const b of order) {
      const bytes = bucketBytes[b] || 0;
      if (bytes <= 0) continue;
      const pct = (bytes / totalBytes) * 100;
      const angle = (bytes / totalBytes) * 360;
      const endAngle = startAngle + angle;

      // Arc path calculation (radius 80, inner radius 56)
      const r = 80;
      const ir = 56;
      const x1 = 100 + r * Math.cos(((startAngle - 90) * Math.PI) / 180);
      const y1 = 100 + r * Math.sin(((startAngle - 90) * Math.PI) / 180);
      const x2 = 100 + r * Math.cos(((endAngle - 90) * Math.PI) / 180);
      const y2 = 100 + r * Math.sin(((endAngle - 90) * Math.PI) / 180);

      const ix1 = 100 + ir * Math.cos(((endAngle - 90) * Math.PI) / 180);
      const iy1 = 100 + ir * Math.sin(((endAngle - 90) * Math.PI) / 180);
      const ix2 = 100 + ir * Math.cos(((startAngle - 90) * Math.PI) / 180);
      const iy2 = 100 + ir * Math.sin(((startAngle - 90) * Math.PI) / 180);

      const largeArc = angle > 180 ? 1 : 0;
      const pathD = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;

      items.push({
        bucket: b,
        bytes,
        pct,
        color: BUCKET_COLORS[b].fill,
        label: BUCKET_LABEL[b],
        startAngle,
        endAngle,
        pathD,
      });

      startAngle = endAngle;
    }

    return items;
  }, [bucketBytes, totalBytes]);

  const activeSlice = hoveredBucket ? slices.find((s) => s.bucket === hoveredBucket) : null;

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-6 sm:gap-8 ${className || ""}`}>
      {/* Donut Chart with Center Data Summary */}
      <div className="relative w-40 h-40 shrink-0 select-none">
        <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
          {totalBytes === 0 ? (
            <circle
              cx="100"
              cy="100"
              r="68"
              fill="transparent"
              stroke="#e2e8f0"
              strokeWidth="24"
              className="dark:stroke-slate-800"
            />
          ) : (
            slices.map((slice) => {
              const isHovered = hoveredBucket === slice.bucket;
              return (
                <path
                  key={slice.bucket}
                  d={slice.pathD}
                  fill={slice.color}
                  className="transition-all duration-200 cursor-pointer hover:opacity-90"
                  style={{
                    transformOrigin: "100px 100px",
                    transform: isHovered ? "scale(1.04)" : "scale(1)",
                  }}
                  onMouseEnter={() => setHoveredBucket(slice.bucket)}
                  onMouseLeave={() => setHoveredBucket(null)}
                />
              );
            })
          )}
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
          {activeSlice ? (
            <>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 truncate max-w-[90px]">
                {activeSlice.label}
              </span>
              <span className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight leading-none mt-0.5">
                {activeSlice.pct.toFixed(0)}%
              </span>
              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                {formatBytes(activeSlice.bytes)}
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                Total
              </span>
              <span className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight leading-none mt-0.5">
                {formatBytes(totalBytes)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                {slices.length} Categories
              </span>
            </>
          )}
        </div>
      </div>

      {/* Category Pills & Breakdown Grid */}
      <div className="flex-1 w-full grid grid-cols-2 gap-2 text-xs">
        {slices.length === 0 ? (
          <div className="col-span-2 text-slate-400 dark:text-slate-500 text-xs py-4 text-center">
            No files scanned yet. Drop folders or files to analyze storage.
          </div>
        ) : (
          slices.map((slice) => {
            const isHovered = hoveredBucket === slice.bucket;
            const style = BUCKET_COLORS[slice.bucket];
            return (
              <div
                key={slice.bucket}
                onMouseEnter={() => setHoveredBucket(slice.bucket)}
                onMouseLeave={() => setHoveredBucket(null)}
                className={clsx(
                  "p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2",
                  isHovered
                    ? "bg-slate-100/90 dark:bg-slate-800 border-slate-300 dark:border-slate-600 scale-[1.02]"
                    : "bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} />
                  <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                    {slice.label}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-semibold text-slate-900 dark:text-white font-mono text-[11px]">
                    {formatBytes(slice.bytes)}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">
                    ({slice.pct.toFixed(0)}%)
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
