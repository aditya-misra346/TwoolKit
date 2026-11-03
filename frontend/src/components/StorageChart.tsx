"use client";

import { useMemo } from "react";
import { formatBytes, BUCKET_LABEL, type StorageBucket } from "@/lib/fileTypes";

interface StorageChartProps {
  bucketBytes: Record<StorageBucket, number>;
  totalBytes: number;
  className?: string;
}

const BUCKET_HEX: Record<StorageBucket, string> = {
  documents: "#3b82f6",
  images: "#10b981",
  videos: "#f59e0b",
  audio: "#8b5cf6",
  archives: "#ec4899",
  presentations: "#f97316",
  other: "#64748b",
};

export function StorageChart({ bucketBytes, totalBytes, className }: StorageChartProps) {
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

      // Arc path calculation (radius 80, inner radius 55)
      const r = 80;
      const ir = 55;
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
        color: BUCKET_HEX[b],
        label: BUCKET_LABEL[b],
        startAngle,
        endAngle,
        pathD,
      });

      startAngle = endAngle;
    }

    return items;
  }, [bucketBytes, totalBytes]);

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-6 sm:gap-10 ${className || ""}`}>
      {/* Donut Chart */}
      <div className="relative w-44 h-44 shrink-0">
        <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
          {totalBytes === 0 ? (
            <circle
              cx="100"
              cy="100"
              r="67.5"
              fill="transparent"
              stroke="#e2e8f0"
              strokeWidth="25"
              className="dark:stroke-slate-800"
            />
          ) : (
            slices.map((slice) => (
              <path
                key={slice.bucket}
                d={slice.pathD}
                fill={slice.color}
                className="transition-all hover:opacity-85 cursor-pointer"
              >
                <title>
                  {slice.label}: {formatBytes(slice.bytes)} ({slice.pct.toFixed(1)}%)
                </title>
              </path>
            ))
          )}
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-xs text-slate-400 font-medium">Analyzed</span>
          <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
            {formatBytes(totalBytes)}
          </span>
        </div>
      </div>

      {/* Legend & Breakdown */}
      <div className="flex-1 w-full grid grid-cols-2 gap-y-2.5 gap-x-4">
        {slices.length === 0 ? (
          <div className="col-span-2 text-xs text-slate-400 py-4 text-center">
            Upload files or scan a folder to visualize storage distribution.
          </div>
        ) : (
          slices.map((slice) => (
            <div key={slice.bucket} className="flex items-center justify-between text-xs min-w-0">
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                  {slice.label}
                </span>
              </div>
              <span className="text-slate-500 dark:text-slate-400 font-semibold ml-2 shrink-0">
                {slice.pct.toFixed(0)}%
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
