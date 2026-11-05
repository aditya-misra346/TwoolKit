"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, TOOLS } from "@/lib/tools";
import { useSettings } from "@/stores/settings";
import { fetchCapabilities } from "@/lib/api";
import { Logo } from "@/components/Logo";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useState } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, set, favorites, cloudConsent } = useSettings();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  // Check actual server processing engine capabilities
  useEffect(() => {
    let active = true;
    fetchCapabilities()
      .then((caps) => {
        if (active) setServerOnline(Boolean(caps));
      })
      .catch(() => {
        if (active) setServerOnline(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const favTools = TOOLS.filter((t) => favorites.includes(t.id));

  return (
    <aside
      className={clsx(
        "hidden md:flex flex-col h-screen max-h-screen sticky top-0 border-r border-slate-800/90 bg-slate-950/95 backdrop-blur-xl transition-[width] duration-200 z-30 select-none overflow-hidden",
        sidebarCollapsed ? "w-[74px]" : "w-[272px] lg:w-[288px]"
      )}
    >
      {/* =========================================================================
          SECTION A: FIXED BRANDING HEADER
          ========================================================================= */}
      <div className="h-16 flex-shrink-0 flex items-center justify-between px-4 border-b border-slate-800/90 bg-slate-950/80">
        <Link
          href="/"
          className={clsx(
            "flex items-center gap-3 overflow-hidden group transition-opacity hover:opacity-90",
            sidebarCollapsed ? "justify-center w-full" : "min-w-0"
          )}
          title="TwoolKit Dashboard"
        >
          {sidebarCollapsed ? (
            <Logo variant="icon" size="sm" theme="dark" />
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <Logo variant="icon" size="sm" theme="dark" />
              <div className="flex flex-col min-w-0">
                <span className="text-[16px] lg:text-[17px] font-black tracking-tight text-white leading-none">
                  TWOOLKIT
                </span>
                <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-1 leading-none">
                  FILE STUDIO
                </span>
              </div>
            </div>
          )}
        </Link>

        {!sidebarCollapsed && (
          <button
            type="button"
            onClick={() => set({ sidebarCollapsed: true })}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors cursor-pointer shrink-0 ml-1"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand control when collapsed */}
      {sidebarCollapsed && (
        <div className="flex-shrink-0 flex justify-center py-1.5 border-b border-slate-800/60 bg-slate-950/40">
          <button
            type="button"
            onClick={() => set({ sidebarCollapsed: false })}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================================
          SECTION B: INDEPENDENTLY SCROLLABLE NAVIGATION AREA
          ========================================================================= */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent pb-10">
        {NAV_SECTIONS.map((section) => (
          <div key={section.id} className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-3 pb-1 text-2xs font-bold tracking-wider text-slate-400 uppercase">
                {section.title}
              </div>
            )}
            <nav className="space-y-1">
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
                      title={item.label}
                      className={clsx(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] lg:text-[16px] transition-all group relative",
                        sidebarCollapsed && "justify-center px-2",
                        active
                          ? "bg-blue-500/15 text-blue-300 font-semibold shadow-2xs"
                          : "text-slate-300 font-medium hover:bg-slate-900/90 hover:text-white"
                      )}
                    >
                      <Icon
                        className={clsx(
                          "w-[18px] h-[18px] shrink-0 transition-transform duration-150 group-hover:scale-105",
                          active
                            ? "text-blue-400"
                            : "text-slate-400 group-hover:text-slate-200"
                        )}
                      />
                      {!sidebarCollapsed && (
                        <span className="truncate leading-snug">{item.label}</span>
                      )}
                      {active && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-500 rounded-r-full" />
                      )}
                    </Link>

                    {/* Floating Tooltip when collapsed */}
                    {sidebarCollapsed && hoveredItem === item.id && (
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold border border-slate-700 shadow-xl whitespace-nowrap z-50 pointer-events-none animate-in fade-in duration-100">
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
          <div className="pt-3 border-t border-slate-800/80 space-y-1">
            <div className="px-3 pb-1 flex items-center justify-between text-2xs font-bold tracking-wider text-slate-400 uppercase">
              <span>Favorites</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="space-y-1">
              {favTools.map((t) => {
                const Icon = t.icon;
                return (
                  <Link
                    key={t.id}
                    href={t.href}
                    title={t.name}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-[15px] font-medium text-slate-300 hover:bg-slate-900/90 hover:text-white transition-colors"
                  >
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{t.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION C: ANCHORED BOTTOM STATUS AREA
          ========================================================================= */}
      <div className="flex-shrink-0 border-t border-slate-800/90 bg-slate-950/95 p-3">
        {!sidebarCollapsed ? (
          <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {serverOnline && cloudConsent ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </>
                ) : serverOnline ? (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-400" />
                )}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-100 truncate leading-tight">
                  {serverOnline && cloudConsent
                    ? "Local & Server Engines"
                    : serverOnline
                    ? "Local Engine (Browser)"
                    : "Local Engine Active"}
                </span>
                <span className="text-2xs text-slate-400 truncate leading-tight mt-0.5">
                  {serverOnline && cloudConsent
                    ? "Hybrid Processing Active"
                    : serverOnline
                    ? "Consent enables server tools"
                    : "WASM & In-Browser Core"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1.5">
            <span
              className={clsx(
                "w-3 h-3 rounded-full transition-transform hover:scale-125 cursor-help",
                serverOnline && cloudConsent
                  ? "bg-emerald-500"
                  : serverOnline
                  ? "bg-amber-400"
                  : "bg-blue-400"
              )}
              title={
                serverOnline && cloudConsent
                  ? "Local & Server Engines Active (Hybrid Mode)"
                  : serverOnline
                  ? "Local Engine Active (Browser Mode · Server Ready upon Consent)"
                  : "Local Engine Active (In-Browser WebAssembly / Rust)"
              }
            />
          </div>
        )}
      </div>
    </aside>
  );
}
