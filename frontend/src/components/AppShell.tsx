"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";
import { TaskDrawer } from "@/components/TaskDrawer";
import { DesktopBridgeProvider } from "@/components/DesktopBridgeProvider";
import { useHistory } from "@/stores/history";
import { useScanStore } from "@/stores/scanStore";
import { useSettings } from "@/stores/settings";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const loadHistory = useHistory((s) => s.load);
  const loadScan = useScanStore((s) => s.loadPersisted);

  useEffect(() => {
    // Hydrate persisted IndexedDB data
    void loadHistory();
    void loadScan();

    // Permanently enforce dark mode on root element
    const root = document.documentElement;
    root.classList.add("dark");
    root.classList.remove("light");
  }, [loadHistory, loadScan]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Collapsible Sidebar on Desktop */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <DesktopBridgeProvider />
        <Header onToggleMobileMenu={() => setMobileDrawerOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <div className="min-h-full flex flex-col justify-between">
            <div className="max-w-[1440px] w-full mx-auto p-4 sm:p-6 lg:p-8 xl:p-10 flex-1">
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
