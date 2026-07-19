import { useCallback, useEffect, useState } from "react";
import type { Settings } from "../types";
import { onMessage, postMessage } from "../vscode";

const DEFAULT_SETTINGS: Settings = {
  releasePrefix: "release/",
  theme: "dark",
  language: "ru",
};

/**
 * Holds the current settings, requests them from the host on mount, and
 * keeps them in sync with both host pushes and local edits.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    postMessage({ command: "getSettings" });
    const unsubscribe = onMessage((message) => {
      if (message.command === "settingsUpdated") {
        setSettings(message.data);
      }
    });
    return unsubscribe;
  }, []);

  /** Patch one or more fields and persist via the host. */
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    postMessage({ command: "updateSettings", data: patch });
  }, []);

  return { settings, updateSettings };
}
