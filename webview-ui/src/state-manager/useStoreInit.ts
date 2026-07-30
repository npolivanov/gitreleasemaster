import { useEffect } from "react";
import { useAppStore } from "./store";
import { onMessage, postMessage } from "../vscode";

/**
 * Wires the settings store to the extension host.
 *
 * Mount this hook once near the root of the app. It requests the initial
 * settings snapshot and subscribes to host pushes, dispatching every
 * settings update into the store.
 */
export function useStoreInit(): void {
  const setSettings = useAppStore((s) => s.setSettings);

  useEffect(() => {
    postMessage({ command: "getSettings" });

    const unsubscribe = onMessage((message) => {
      if (message.command === "settingsUpdated") {
        setSettings(message.data);
      }
    });

    return unsubscribe;
  }, [setSettings]);
}
