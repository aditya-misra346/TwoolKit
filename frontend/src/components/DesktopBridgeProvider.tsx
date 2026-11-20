"use client";

/**
 * Global Web Keyboard Shortcuts & Offline Resilience Provider.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";

export function DesktopBridgeProvider() {
  const router = useRouter();
  const [isOffline, setIsOffline] = useState(false);

  // 1. Track network online/offline resilience
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 2. Global Web Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();

      // Cmd/Ctrl + , -> Settings
      if (key === ",") {
        e.preventDefault();
        router.push("/settings");
        return;
      }

      // Cmd/Ctrl + O -> Open File Scanner
      if (key === "o" && !e.shiftKey) {
        e.preventDefault();
        router.push("/scanner");
        return;
      }

      // Cmd/Ctrl + Shift + U -> Universal Upload on Dashboard
      if (key === "u" && e.shiftKey) {
        e.preventDefault();
        router.push("/");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <>
      {isOffline && (
        <div className="bg-amber-500/95 text-white px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 z-50 shadow-xs">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>
            Offline Mode Active — In-browser tools (Scanner, PDF Merge/Split/Protect, Image Studio, ZIP) remain 100% operational. Cloud server conversions are paused until connection is restored.
          </span>
        </div>
      )}
    </>
  );
}
