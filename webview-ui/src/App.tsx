import { useMemo, useState } from "react";
import { Box, CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { styled } from "@mui/material/styles";
import { TopBar } from "./components/TopBar";
import { HomeScreen } from "./screens/HomeScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { useSettings } from "./hooks/useSettings";

type View = "home" | "settings";

const Shell = styled(Box)(() => ({
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
}));

function App() {
  const { settings, updateSettings } = useSettings();
  const [view, setView] = useState<View>("home");

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: settings.theme,
          primary: { main: "#aa3bff" },
          secondary: { main: "#5570ff" },
          background: {
            default: settings.theme === "dark" ? "#16171d" : "#f7f7fa",
            paper: settings.theme === "dark" ? "#1c1d24" : "#ffffff",
          },
        },
        shape: { borderRadius: 8 },
        typography: {
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
        {view === "home" ? (
          <HomeScreen language={settings.language} />
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
