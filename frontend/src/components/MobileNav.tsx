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
          className="fixed inset-0 z-50 md:hidden bg-slate-950/75 backdrop-blur-xs flex animate-in fade-in duration-150"
          onClick={onCloseDrawer}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="w-[86%] max-w-sm bg-slate-950 h-full p-5 flex flex-col shadow-2xl border-r border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <Logo variant="icon" size="sm" theme="dark" />
                <div className="flex flex-col min-w-0">
                  <span className="text-base font-black tracking-tight text-white leading-none">
                    TWOOLKIT
                  </span>
                  <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-1 leading-none">
                    FILE STUDIO
                  </span>
                </div>
              </div>
              <button
                onClick={onCloseDrawer}
                className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Navigation List */}
            <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 pb-8">
              {NAV_SECTIONS.map((section) => (
                <div key={section.id} className="space-y-1">
                  <div className="px-3 pb-1 text-2xs font-bold tracking-wider text-slate-400 uppercase">
                    {section.title}
                  </div>
                  <nav className="space-y-1">
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
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15.5px] font-medium transition-colors relative",
                            active
                              ? "bg-blue-500/15 text-blue-300 font-semibold"
                              : "text-slate-300 hover:bg-slate-900 hover:text-white"
                          )}
                        >
                          <Icon
                            className={clsx(
                              "w-[18px] h-[18px] shrink-0",
                              active ? "text-blue-400" : "text-slate-400"
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                          {active && (
                            <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-500 rounded-r-full" />
                          )}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>

            {/* Drawer Bottom Status */}
            <div className="pt-3 border-t border-slate-800">
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs font-semibold text-slate-200 truncate">
                  Local & Server Engines Active
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md z-30 flex items-center justify-around px-1.5 pb-[env(safe-area-inset-bottom)]">
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
                "flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all min-w-0",
                active
                  ? "text-blue-400 font-semibold"
                  : "text-slate-300 font-medium hover:text-white"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[11.5px] mt-1 tracking-tight truncate max-w-[68px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
