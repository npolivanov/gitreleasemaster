import { create } from "zustand";
import type { Settings } from "../types";
import { postMessage } from "../vscode";

/**
 * Default settings mirror the extension host defaults declared in
 * `package.json` contributes.configuration. Used as the initial store value
 * until the host replies with the canonical snapshot.
 */
const DEFAULT_SETTINGS: Settings = {
  releasePrefix: "release/",
  theme: "dark",
  language: "ru",
};

type View = "home" | "settings";

/**
 * Central application store.
 *
 * Holds only settings and the active view. Branches stay where they were
 * (the `useBranches` hook) — this store is intentionally about settings only.
 */
export interface AppState {
  // --- settings ---
  settings: Settings;
  /** Replace the whole settings object (used on host pushes). */
  setSettings: (settings: Settings) => void;
  /** Optimistically patch settings locally and persist via the host. */
  updateSettings: (patch: Partial<Settings>) => void;

  // --- active view ---
  view: View;
  setView: (view: View) => void;
}

export const useAppStore = create<AppState>((set) => ({
  settings: DEFAULT_SETTINGS,
  setSettings: (settings) => set({ settings }),
  updateSettings: (patch) => {
    set((state) => ({ settings: { ...state.settings, ...patch } }));
    postMessage({ command: "updateSettings", data: patch });
  },

  view: "home",
  setView: (view) => set({ view }),
}));
