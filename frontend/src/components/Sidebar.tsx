"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, TOOLS } from "@/lib/tools";
import { useSettings } from "@/stores/settings";
import { ChevronLeft, ChevronRight, Layers, Sparkles } from "lucide-react";
import clsx from "clsx";

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, set, favorites } = useSettings();

  const favTools = TOOLS.filter((t) => favorites.includes(t.id));

  return (
    <aside
      className={clsx(
        "hidden md:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md transition-all duration-300 z-30 select-none",
        sidebarCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-base tracking-tight text-slate-900 dark:text-white leading-none">
                Vellum
              </span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tracking-wider uppercase mt-1">
                File Platform
              </span>
            </div>
          )}
        </Link>
        <button
          onClick={() => set({ sidebarCollapsed: !sidebarCollapsed })}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          {!sidebarCollapsed && (
            <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              Navigation
            </div>
          )}
          <nav className="space-y-1">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all group relative",
                    active
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-semibold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <Icon className={clsx("w-5 h-5 shrink-0 transition-transform group-hover:scale-105", active && "text-blue-600 dark:text-blue-400")} />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  {active && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 dark:bg-blue-400 rounded-r-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Favorite Tools */}
        {!sidebarCollapsed && favTools.length > 0 && (
          <div>
            <div className="px-3 mb-2 flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              <span>Pinned Tools</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="space-y-1">
              {favTools.map((t) => {
                const Icon = t.icon;
                return (
                  <Link
                    key={t.id}
                    href={t.href}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:text-slate-500" />
                    <span className="truncate">{t.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      {!sidebarCollapsed && (
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">In-Browser & Server Ready</span>
          </div>
        </div>
      )}
    </aside>
  );
}
