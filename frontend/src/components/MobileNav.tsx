"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, MOBILE_NAV, NAV } from "@/lib/tools";
import { X } from "lucide-react";
import { Logo } from "@/components/Logo";
import clsx from "clsx";
import { useEffect } from "react";

interface MobileNavProps {
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

export function MobileNav({ drawerOpen, onCloseDrawer }: MobileNavProps) {
  const pathname = usePathname();

  // Close on Escape key press
  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseDrawer();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen, onCloseDrawer]);

  // Lock background body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [drawerOpen]);

  return (
    <>
      {/* Slide-over Drawer for All Links */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-slate-950/70 backdrop-blur-xs flex animate-in fade-in duration-150"
          onClick={onCloseDrawer}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="w-4/5 max-w-xs bg-slate-950 h-full p-4 flex flex-col shadow-2xl border-r border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Logo variant="icon" size="sm" theme="dark" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-black tracking-tight text-white leading-none">
                    TWOOLKIT
                  </span>
                  <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase mt-0.5 leading-none">
                    FILE STUDIO
                  </span>
                </div>
              </div>
              <button
                onClick={onCloseDrawer}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-850 transition-colors cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Navigation List */}
            <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-800 pb-8">
              {NAV_SECTIONS.map((section) => (
                <div key={section.id} className="space-y-0.5">
                  <div className="px-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    {section.title}
                  </div>
                  <nav className="space-y-0.5">
                    {section.items.map((item) => {
                      const isExact = pathname === item.href;
                      const isNested = item.href !== "/" && pathname.startsWith(item.href);
                      const active = isExact || isNested;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={onCloseDrawer}
                          className={clsx(
                            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors relative",
                            active
                              ? "bg-blue-500/10 text-blue-400 font-semibold"
                              : "text-slate-400 hover:bg-slate-900/80 hover:text-slate-200"
                          )}
                        >
                          <Icon
                            className={clsx(
                              "w-4 h-4 shrink-0",
                              active ? "text-blue-400" : "text-slate-500"
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                          {active && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-500 rounded-r-full" />
                          )}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>

            {/* Drawer Bottom Status */}
            <div className="pt-2 border-t border-slate-800">
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/70 border border-slate-800/80 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[10px] font-medium text-slate-400 truncate">
                  Local & Server Engines Active
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md z-30 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {MOBILE_NAV.map((navId) => {
          const item = NAV.find((n) => n.id === navId);
          if (!item) return null;
          const isExact = pathname === item.href;
          const isNested = item.href !== "/" && pathname.startsWith(item.href);
          const active = isExact || isNested;
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={clsx(
                "flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-all",
                active
                  ? "text-blue-400 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
