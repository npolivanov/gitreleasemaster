import { HomeScreen } from "./Home";
import { SettingsScreen } from "./Settings";
import { CreateReleaseScreen } from "./CreateRelease";
import { useSettingsStore } from "../state-manager/useSettingsStore";
import type { Settings } from "../types";

interface ScreenRouterProps {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

/**
 * Renders the active screen based on the `view` stored in the app store.
 *
 * Add new screens here — they should also be added to the `View` type in
 * `state-manager/store.ts`.
 */
export function ScreenRouter({ settings, updateSettings }: ScreenRouterProps) {
  const { view } = useSettingsStore();

  switch (view) {
    case "settings":
      return (
        <SettingsScreen
          language={settings.language}
          settings={settings}
          updateSettings={updateSettings}
          themeMode={settings.theme}
        />
      );
    case "createRelease":
      return <CreateReleaseScreen />;
    case "home":
    default:
      return (
        <HomeScreen
          language={settings.language}
          releasePrefix={settings.releasePrefix}
        />
      );
  }
}
