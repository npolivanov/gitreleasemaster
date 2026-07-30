import { useAppStore } from "./store";

/**
 * Convenience hook over the settings store.
 *
 * Returns everything the UI needs in one object — no manual selectors spread
 * across the component:
 *
 *   const { settings, updateSettings, view, setView } = useSettingsStore();
 */
export function useSettingsStore() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  return { settings, updateSettings, view, setView };
}
