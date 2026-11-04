"use client";
/**
 * User preferences, persisted to localStorage. There is no account system:
 * everything here stays in this browser profile.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePref = "system" | "light" | "dark";
export type CompressionLevel = "low" | "balanced" | "max";

export interface Settings {
  profileName: string;
  theme: ThemePref;
  motion: "system" | "reduce" | "full";
  sidebarCollapsed: boolean;
  /** User has consented to uploading files to the TWOOLKIT processing server. */
  cloudConsent: boolean;
  /** Ask before every server upload even when consent was given. */
  confirmEachUpload: boolean;
  /** Delete server copies immediately after results are downloaded to the browser. */
  purgeServerAfterDownload: boolean;
  /** Keep processed outputs in IndexedDB so they can be re-downloaded from Recent files. */
  keepOutputs: boolean;
  maxOutputStorageMB: number;
  localConcurrency: number;
  serverConcurrency: number;
  defaultImageFormat: "webp" | "jpeg" | "png" | "avif";
  defaultImageQuality: number;
  defaultDocTarget: string;
  defaultCompression: CompressionLevel;
  ocrLanguage: string;
  favorites: string[];
  /** Optional Gemini API key for the AI assistant (stored only in this browser). */
  geminiApiKey: string;
  geminiModel: string;
  stripMetadataByDefault: boolean;
}

const defaults: Settings = {
  profileName: "",
  theme: "dark",
  motion: "system",
  sidebarCollapsed: false,
  cloudConsent: false,
  confirmEachUpload: false,
  purgeServerAfterDownload: true,
  keepOutputs: true,
  maxOutputStorageMB: 500,
  localConcurrency: 3,
  serverConcurrency: 2,
  defaultImageFormat: "webp",
  defaultImageQuality: 82,
  defaultDocTarget: "pdf",
  defaultCompression: "balanced",
  ocrLanguage: "eng",
  favorites: ["pdf-merge", "image-convert", "compress", "scanner"],
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
  stripMetadataByDefault: true,
};

interface SettingsState extends Settings {
  set: (patch: Partial<Settings>) => void;
  toggleFavorite: (toolId: string) => void;
  reset: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaults,
      set: (patch) => set(patch),
      toggleFavorite: (id) => {
        const f = get().favorites;
        set({ favorites: f.includes(id) ? f.filter((x) => x !== id) : [...f, id] });
      },
      reset: () => set({ ...defaults }),
    }),
    { name: "vellum-settings", version: 1 }
  )
);

export const settingsDefaults = defaults;
