import { useMemo } from "react";
import { Box, CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { styled } from "@mui/material/styles";
import { TopBar } from "./components/TopBar";
import { HomeScreen } from "./screens/HomeScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { useSettingsStore } from "./state-manager/useSettingsStore";
import { useStoreInit } from "./state-manager/useStoreInit";

const Shell = styled(Box)(() => ({
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
}));

function App() {
  const { settings, updateSettings, view, setView } = useSettingsStore();

  // Connect the store to the extension host (request + single subscription).
  useStoreInit();

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: settings.theme,
          primary: { main: "#212121" },
          secondary: { main: "#fafafa" },
          background: {
            default: settings.theme === "dark" ? "#212121" : "#fafafa",
            paper: settings.theme === "dark" ? "#212121" : "#fafafa",
          },
        },
        shape: { borderRadius: 8 },
        typography: {
          fontFamily: "Roboto, sans-serif",
        },
      }),
    [settings.theme],
  );

  console.log("settings >>>", settings);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Shell>
        <TopBar
          language={settings.language}
          view={view}
          onOpenSettings={() => setView("settings")}
          onBackHome={() => setView("home")}
        />
        {view === "home" ? (
          <HomeScreen
            language={settings.language}
            releasePrefix={settings.releasePrefix}
          />
        ) : (
          <SettingsScreen
            language={settings.language}
            settings={settings}
            updateSettings={updateSettings}
            themeMode={settings.theme}
          />
        )}
      </Shell>
    </ThemeProvider>
  );
}

export default App;
