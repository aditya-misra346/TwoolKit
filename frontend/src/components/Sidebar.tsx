"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, TOOLS } from "@/lib/tools";
import { useSettings } from "@/stores/settings";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  Search,
} from "lucide-react";
import clsx from "clsx";
import { useState } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, set, favorites } = useSettings();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const favTools = TOOLS.filter((t) => favorites.includes(t.id));

  return (
    <aside
      className={clsx(
        "hidden md:flex flex-col border-r border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md transition-all duration-200 z-30 select-none relative",
        sidebarCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200/70 dark:border-slate-800/70">
        <Link href="/" className="flex items-center gap-3 overflow-hidden group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white leading-none">
                TWOOLKIT
              </span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tracking-wider uppercase mt-1">
                Workspace
              </span>
            </div>
          )}
        </Link>
        <button
          onClick={() => set({ sidebarCollapsed: !sidebarCollapsed })}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Navigation List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.id} className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                {section.title}
              </div>
            )}
            <nav className="space-y-0.5">
              {section.items.map((item) => {
                const isExact = pathname === item.href;
                const isNested = item.href !== "/" && pathname.startsWith(item.href);
                const active = isExact || isNested;
                const Icon = item.icon;

                return (
                  <div
                    key={item.id}
                    className="relative"
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Link
                      href={item.href}
                      className={clsx(
                        "flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium transition-all group relative",
                        active
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold shadow-2xs"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-200"
                      )}
                    >
                      <Icon
                        className={clsx(
                          "w-4 h-4 shrink-0 transition-transform group-hover:scale-105",
                          active
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                        )}
                      />
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-600 dark:bg-blue-400 rounded-r-full" />
                      )}
                    </Link>

                    {/* Floating Tooltip when collapsed */}
                    {sidebarCollapsed && hoveredItem === item.id && (
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[11px] font-medium shadow-xl whitespace-nowrap z-50 pointer-events-none animate-in fade-in duration-100">
                        {item.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        ))}

        {/* Pinned Favorites */}
        {!sidebarCollapsed && favTools.length > 0 && (
          <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/70 space-y-1">
            <div className="px-3 pb-1 flex items-center justify-between text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              <span>Favorites</span>
              <Sparkles className="w-3 h-3 text-amber-500" />
            </div>
            <div className="space-y-0.5">
              {favTools.map((t) => {
                const Icon = t.icon;
                return (
                  <Link
                    key={t.id}
                    href={t.href}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{t.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer System Status */}
      {!sidebarCollapsed ? (
        <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/70 text-[11px] text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-2 px-1 py-1 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 ml-1.5" />
            <span className="truncate font-medium text-[10px] text-slate-600 dark:text-slate-400">
              Local & Server Engines
            </span>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/70 flex justify-center">
          <span className="w-2 h-2 rounded-full bg-emerald-500" title="All engines operational" />
        </div>
      )}
    </aside>
  );
}
