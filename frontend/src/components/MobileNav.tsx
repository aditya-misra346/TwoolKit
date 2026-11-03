"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, MOBILE_NAV, NAV } from "@/lib/tools";
import { X } from "lucide-react";
import { Logo } from "@/components/Logo";
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
        <div className="fixed inset-0 z-50 md:hidden bg-slate-950/60 backdrop-blur-xs flex animate-in fade-in duration-150">
          <div
            className="w-4/5 max-w-xs bg-white dark:bg-slate-900 h-full p-5 flex flex-col shadow-2xl border-r border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <Logo variant="full" size="sm" />
              <button
                onClick={onCloseDrawer}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {NAV_SECTIONS.map((section) => (
                <div key={section.id} className="space-y-1">
                  <div className="px-2 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
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
                            "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                            active
                              ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-semibold"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md z-30 flex items-center justify-around px-2">
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
                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
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
