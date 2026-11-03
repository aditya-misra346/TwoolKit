"use client";

import React, { useId } from "react";
import clsx from "clsx";

export type LogoVariant = "full" | "compact" | "icon" | "symbol";
export type LogoTheme = "auto" | "dark" | "light" | "monochrome";
export type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

interface LogoProps {
  variant?: LogoVariant;
  theme?: LogoTheme;
  size?: LogoSize;
  className?: string;
  showDescriptor?: boolean;
}

const SIZE_MAP = {
  xs: { icon: 20, height: "h-5", text: "text-xs", desc: "text-[6px]" },
  sm: { icon: 24, height: "h-6", text: "text-sm", desc: "text-[7px]" },
  md: { icon: 32, height: "h-8", text: "text-base", desc: "text-[8px]" },
  lg: { icon: 40, height: "h-10", text: "text-lg", desc: "text-[9px]" },
  xl: { icon: 48, height: "h-12", text: "text-xl", desc: "text-[10px]" },
};

export function Logo({
  variant = "full",
  theme = "auto",
  size = "md",
  className,
  showDescriptor = true,
}: LogoProps) {
  const id = useId();
  const topGradId = `tk-top-${id}`;
  const stemGradId = `tk-stem-${id}`;
  const bgGradId = `tk-bg-${id}`;
  const borderGlowId = `tk-border-${id}`;

  const currentSize = SIZE_MAP[size];

  // Mathematical vector path definitions for the TWOOLKIT T-Nexus
  const pathTop =
    "M 7 7 L 25 7 Q 26.8 7 26.8 8.8 L 26.8 11.2 Q 26.8 13 25 13 L 19.5 13 L 16 9.5 L 12.5 13 L 7 13 Q 5.2 13 5.2 11.2 L 5.2 8.8 Q 5.2 7 7 7 Z";
  const pathStem =
    "M 16 12 L 20.2 16.2 Q 21 17 21 17.9 L 21 23.8 Q 21 25.5 19.2 25.5 L 12.8 25.5 Q 11 25.5 11 23.8 L 11 17.9 Q 11 17 11.8 16.2 L 16 12 Z";

  const isMono = theme === "monochrome";

  // Core Vector Symbol
  const renderSymbol = () => (
    <svg
      viewBox="0 0 32 32"
      width={currentSize.icon}
      height={currentSize.icon}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-200"
    >
      <defs>
        <linearGradient id={topGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id={stemGradId} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="40%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
      </defs>
      <path
        d={pathTop}
        fill={
          isMono
            ? "currentColor"
            : `url(#${topGradId})`
        }
      />
      <path
        d={pathStem}
        fill={
          isMono
            ? "currentColor"
            : `url(#${stemGradId})`
        }
      />
    </svg>
  );

  // Icon Variant in a High-Tech Squircle Container
  const renderIconBox = () => (
    <div
      className={clsx(
        "relative rounded-xl flex items-center justify-center p-1.5 shadow-xs border transition-all shrink-0",
        theme === "dark" || theme === "auto"
          ? "bg-slate-900/90 dark:bg-slate-900/90 border-slate-700/60 dark:border-slate-800 shadow-slate-950/40"
          : "bg-white border-slate-200/80 shadow-slate-100",
        size === "xs" && "w-6 h-6 rounded-md p-1",
        size === "sm" && "w-7 h-7 rounded-lg p-1",
        size === "md" && "w-9 h-9 rounded-xl p-1.5",
        size === "lg" && "w-11 h-11 rounded-2xl p-2",
        size === "xl" && "w-14 h-14 rounded-2xl p-2.5"
      )}
    >
      {renderSymbol()}
    </div>
  );

  if (variant === "symbol") {
    return <div className={clsx("inline-flex items-center", className)}>{renderSymbol()}</div>;
  }

  if (variant === "icon") {
    return <div className={clsx("inline-flex items-center", className)}>{renderIconBox()}</div>;
  }

  // Horizontal Full or Compact Logo
  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2.5 select-none tracking-tight group",
        className
      )}
      role="img"
      aria-label="TWOOLKIT"
    >
      {renderIconBox()}

      <div className="flex flex-col min-w-0">
        <span
          className={clsx(
            "font-black tracking-tight leading-none",
            currentSize.text,
            theme === "dark" && "text-white",
            theme === "light" && "text-slate-950",
            theme === "auto" && "text-slate-950 dark:text-white",
            theme === "monochrome" && "text-current"
          )}
        >
          TWOOLKIT
        </span>
        {variant === "full" && showDescriptor && (
          <span
            className={clsx(
              "font-bold uppercase tracking-widest mt-1 text-slate-400 dark:text-slate-500",
              currentSize.desc
            )}
          >
            Workspace
          </span>
        )}
      </div>
    </div>
  );
}
