"use client";

import { useState } from "react";
import { useSettings } from "@/stores/settings";
import { useQueue } from "@/stores/tasks";
import { CommandPalette } from "./CommandPalette";
import { ConsentModal } from "./ConsentModal";
import { Logo } from "./Logo";
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  ListTodo,
  Menu,
} from "lucide-react";
import clsx from "clsx";

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export function Header({ onToggleMobileMenu }: HeaderProps) {
  const { cloudConsent } = useSettings();
  const { order, tasks, setDrawer } = useQueue();

  const [searchOpen, setSearchOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  const activeTaskCount = order.filter(
    (id) => tasks[id]?.status === "running" || tasks[id]?.status === "queued"
  ).length;

  return (
    <>
      <header className="h-14 px-4 md:px-6 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-20 select-none">
        {/* Left: Mobile Menu Toggle & Raycast-style Search Bar */}
        <div className="flex items-center gap-3 flex-1 max-w-lg">
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle mobile menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="md:hidden">
            <Logo variant="compact" size="xs" />
          </div>

          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-400/60 dark:hover:border-blue-500/60 transition-all shadow-2xs group cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
            <span className="truncate">Search 42+ tools, conversions, shortcuts...</span>
            <kbd className="hidden sm:inline-block ml-auto px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: Cloud Consent Badge, Queue Trigger, 3-Way Theme Switcher */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Cloud Consent Indicator */}
          <button
            onClick={() => setConsentOpen(true)}
            className={clsx(
              "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium border transition-all cursor-pointer",
              cloudConsent
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100/60"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/60"
            )}
            title="Configure in-browser vs local server processing"
          >
            {cloudConsent ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Server Engines Ready</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                <span>Browser-Only Mode</span>
              </>
            )}
          </button>

          {/* Queue Drawer Trigger */}
          <button
            onClick={() => setDrawer(true)}
            className={clsx(
              "relative p-2 rounded-xl transition-colors cursor-pointer",
              activeTaskCount > 0
                ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            )}
            title="View batch processing queue"
            aria-label="Open processing queue"
          >
            <ListTodo className="w-4 h-4" />
            {activeTaskCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center animate-pulse">
                {activeTaskCount}
              </span>
            )}
          </button>

          {/* 3-Way Segmented Theme Switcher (Light / Dark / System) */}
          <div
            role="group"
            aria-label="Theme mode"
            className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80"
          >
            {[
              { id: "light" as const, icon: Sun, title: "Light theme" },
              { id: "dark" as const, icon: Moon, title: "Dark theme" },
              { id: "system" as const, icon: Laptop, title: "System theme" },
            ].map((item) => {
              const Icon = item.icon;
              const active = theme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setThemeMode(item.id)}
                  title={item.title}
                  aria-label={item.title}
                  className={clsx(
                    "p-1.5 rounded-lg transition-all cursor-pointer",
                    active
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs"
                      : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Raycast-style Universal Command Palette */}
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Cloud Consent & Engine Permissions Modal */}
      <ConsentModal isOpen={consentOpen} onClose={() => setConsentOpen(false)} />
    </>
  );
}
