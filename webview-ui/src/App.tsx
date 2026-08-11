import { useMemo } from "react";
import { Box, CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { styled } from "@mui/material/styles";
import { TopBar } from "./components/TopBar";
import { ScreenRouter } from "./screens/ScreenRouter";
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
        <ScreenRouter settings={settings} updateSettings={updateSettings} />
      </Shell>
    </ThemeProvider>
  );
}

export default App;
