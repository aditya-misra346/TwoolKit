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
      <header className="h-16 px-4 md:px-6 lg:px-8 border-b border-slate-800/90 bg-slate-950/85 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-20 select-none">
        {/* Left: Mobile Menu Toggle & Raycast-style Search Bar */}
        <div className="flex items-center gap-3 flex-1 max-w-xl min-w-0">
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
            aria-label="Toggle mobile menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="md:hidden shrink-0">
            <Logo variant="compact" size="xs" />
          </div>

          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm text-slate-300 bg-slate-900/85 border border-slate-800 hover:border-blue-500/60 hover:text-white transition-all shadow-2xs group cursor-pointer min-w-0"
          >
            <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
            <span className="truncate font-medium">
              Search 48+ tools, conversions, shortcuts...
            </span>
            <kbd className="hidden sm:inline-block ml-auto px-2 py-0.5 text-2xs font-semibold text-slate-300 bg-slate-800 rounded-md border border-slate-700 font-mono shrink-0">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: Cloud Consent Badge & Queue Trigger */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Cloud Consent Indicator */}
          <button
            onClick={() => setConsentOpen(true)}
            className={clsx(
              "hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
              cloudConsent
                ? "bg-emerald-950/50 text-emerald-300 border-emerald-800/70 hover:bg-emerald-950/80"
                : "bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800"
            )}
            title="Configure in-browser vs local server processing"
          >
            {cloudConsent ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Server Engines Ready</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Browser-Only Mode</span>
              </>
            )}
          </button>

          {/* Queue Drawer Trigger */}
          <button
            onClick={() => setDrawer(true)}
            className={clsx(
              "relative p-2.5 rounded-xl border transition-colors cursor-pointer",
              activeTaskCount > 0
                ? "text-blue-400 bg-blue-950/60 border-blue-800/70"
                : "text-slate-300 border-slate-800 bg-slate-900/70 hover:text-white hover:bg-slate-800"
            )}
            title="View batch processing queue"
            aria-label="Open processing queue"
          >
            <ListTodo className="w-5 h-5" />
            {activeTaskCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white font-bold text-2xs flex items-center justify-center animate-pulse">
                {activeTaskCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Raycast-style Universal Command Palette */}
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Cloud Consent & Engine Permissions Modal */}
      <ConsentModal isOpen={consentOpen} onClose={() => setConsentOpen(false)} />
    </>
  );
}
