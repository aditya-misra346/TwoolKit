"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, MOBILE_NAV } from "@/lib/tools";
import { Layers, X } from "lucide-react";
import clsx from "clsx";

interface MobileNavProps {
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

export function MobileNav({ drawerOpen, onCloseDrawer }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Slide-over Drawer for All Links */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-950/50 backdrop-blur-xs flex">
          <div
            className="w-4/5 max-w-xs bg-white dark:bg-slate-900 h-full p-5 flex flex-col shadow-2xl border-r border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="font-bold text-base text-slate-900 dark:text-white">Vellum</span>
              </div>
              <button onClick={onCloseDrawer} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 space-y-1">
              {NAV.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={onCloseDrawer}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      active
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-30 flex items-center justify-around px-2">
        {MOBILE_NAV.map((navId) => {
          const item = NAV.find((n) => n.id === navId);
          if (!item) return null;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={clsx(
                "flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all",
                active
                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
