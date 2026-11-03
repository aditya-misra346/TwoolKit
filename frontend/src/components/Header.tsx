"use client";

import { useState } from "react";
import { useSettings } from "@/stores/settings";
import { useQueue } from "@/stores/tasks";
import { CommandPalette } from "./CommandPalette";
import { ConsentModal } from "./ConsentModal";
import {
  Search,
  Moon,
  Sun,
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
  const { theme, set, cloudConsent } = useSettings();
  const { order, tasks, setDrawer } = useQueue();

  const [searchOpen, setSearchOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  const activeTaskCount = order.filter(
    (id) => tasks[id]?.status === "running" || tasks[id]?.status === "queued"
  ).length;

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      document.documentElement.classList.remove("dark");
      set({ theme: "light" });
    } else {
      document.documentElement.classList.add("dark");
      set({ theme: "dark" });
    }
  };

  return (
    <>
      <header className="h-16 px-4 md:px-6 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-20">
        {/* Left: Mobile Menu Toggle & Search Bar */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-2xs group"
          >
            <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
            <span className="truncate">Search tools, actions, files...</span>
            <kbd className="hidden sm:inline-block ml-auto px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: Cloud Consent Badge, Queue Trigger, Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cloud Consent Indicator */}
          <button
            onClick={() => setConsentOpen(true)}
            className={clsx(
              "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
              cloudConsent
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            )}
            title="Configure in-browser vs local server processing"
          >
            {cloudConsent ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Server Ready</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                <span>Local Only</span>
              </>
            )}
          </button>

          {/* Queue Drawer Trigger */}
          <button
            onClick={() => setDrawer(true)}
            className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title="View batch queue"
          >
            <ListTodo className="w-5 h-5" />
            {activeTaskCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {activeTaskCount}
              </span>
            )}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <ConsentModal isOpen={consentOpen} onClose={() => setConsentOpen(false)} />
    </>
  );
}
