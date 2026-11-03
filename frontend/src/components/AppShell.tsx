"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";
import { TaskDrawer } from "@/components/TaskDrawer";
import { useHistory } from "@/stores/history";
import { useScanStore } from "@/stores/scanStore";
import { useSettings } from "@/stores/settings";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const loadHistory = useHistory((s) => s.load);
  const loadScan = useScanStore((s) => s.loadPersisted);
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    // Hydrate persisted IndexedDB data
    void loadHistory();
    void loadScan();
  }, [loadHistory, loadScan]);

  useEffect(() => {
    // Apply theme
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      // System
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) root.classList.add("dark");
      else root.classList.remove("dark");
    }
  }, [theme]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Collapsible Sidebar on Desktop */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header onToggleMobileMenu={() => setMobileDrawerOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <div className="min-h-full flex flex-col justify-between">
            <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1">
              {children}
            </div>
            <Footer />
          </div>
        </main>
      </div>

      {/* Mobile Nav & Drawer */}
      <MobileNav
        drawerOpen={mobileDrawerOpen}
        onCloseDrawer={() => setMobileDrawerOpen(false)}
      />

      {/* Global Batch Processing Queue Drawer */}
      <TaskDrawer />
    </div>
  );
}
