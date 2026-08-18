import { useState } from "react";
import {
  Box,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { styled } from "@mui/material/styles";
import ReactJson from "@microlink/react-json-view";
import type { Language, Settings, ThemeMode } from "../../types";
import { t } from "../../i18n";

const Page = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
}));

const FieldCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2.5),
  background: theme.palette.mode === "dark" ? "#1c1d24" : "#fff",
}));

const FieldLabel = styled(Typography)({
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 4,
});

const FieldHelp = styled(Typography)(({ theme }) => ({
  fontSize: 12,
  color: theme.palette.text.secondary,
  marginTop: 4,
}));

interface SettingsScreenProps {
  language: Language;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Used to drive react-json-view's own theme. */
  themeMode: ThemeMode;
}

export function SettingsScreen({
  language,
  settings,
  updateSettings,
  themeMode,
}: SettingsScreenProps) {
  const [tab, setTab] = useState<0 | 1>(0);

  return (
    <Page>
      <Box>
        <Tabs value={tab} onChange={(_, value) => setTab(value as 0 | 1)}>
          <Tab label={t(language, "tabGeneral")} />
          <Tab label={t(language, "tabJson")} />
        </Tabs>
      </Box>

      {tab === 0 ? (
        <GeneralTab
          language={language}
          settings={settings}
          updateSettings={updateSettings}
        />
      ) : (
        <JsonTab
          language={language}
          settings={settings}
          updateSettings={updateSettings}
          themeMode={themeMode}
        />
      )}
    </Page>
  );
}

interface GeneralTabProps {
  language: Language;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

function GeneralTab({ language, settings, updateSettings }: GeneralTabProps) {
  return (
    <Stack spacing={2}>
      <FieldCard elevation={0} variant="outlined">
        <FieldLabel>{t(language, "releasePrefix")}</FieldLabel>
        <TextField
          fullWidth
          size="small"
          value={settings.releasePrefix}
          onChange={(e) => {
            updateSettings({ releasePrefix: e.target.value });
          }}
          placeholder="release/"
        />
        <FieldHelp>{t(language, "releasePrefixHelp")}</FieldHelp>
      </FieldCard>

      <FieldCard elevation={0} variant="outlined">
        <FieldLabel>{t(language, "theme")}</FieldLabel>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={settings.theme}
          onChange={(_, value: ThemeMode | null) => {
            if (value) updateSettings({ theme: value });
          }}
        >
          <ToggleButton value="dark">
            <DarkModeIcon fontSize="small" sx={{ mr: 1 }} />
            {t(language, "themeDark")}
          </ToggleButton>
          <ToggleButton value="light">
            <LightModeIcon fontSize="small" sx={{ mr: 1 }} />
            {t(language, "themeLight")}
          </ToggleButton>
        </ToggleButtonGroup>
      </FieldCard>

      <FieldCard elevation={0} variant="outlined">
        <FieldLabel>{t(language, "language")}</FieldLabel>
        <TextField
          select
          size="small"
          value={settings.language}
          onChange={(e) =>
            updateSettings({ language: e.target.value as Language })
          }
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="ru">Русский</MenuItem>
          <MenuItem value="en">English</MenuItem>
        </TextField>
      </FieldCard>
    </Stack>
  );
}

interface JsonTabProps {
  language: Language;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  themeMode: ThemeMode;
}

function JsonTab({
  language,
  settings,
  updateSettings,
  themeMode,
}: JsonTabProps) {
  const handleEdit = (next: Partial<Settings>): boolean => {
    const patch: Partial<Settings> = {};
    if (
      typeof next.releasePrefix === "string" &&
      next.releasePrefix !== settings.releasePrefix
    ) {
      patch.releasePrefix = next.releasePrefix;
    }
    if (next.theme === "dark" || next.theme === "light") {
      if (next.theme !== settings.theme) patch.theme = next.theme;
    } else if (next.theme !== undefined) {
      return false; // reject invalid value, react-json-view will revert
    }
    if (next.language === "ru" || next.language === "en") {
      if (next.language !== settings.language) patch.language = next.language;
    } else if (next.language !== undefined) {
      return false;
    }
    if (Object.keys(patch).length > 0) updateSettings(patch);
    return true;
  };

  return (
    <FieldCard elevation={0} variant="outlined">
      <FieldHelp sx={{ mt: 0, mb: 1.5 }}>{t(language, "jsonHelp")}</FieldHelp>
      <Box sx={{ fontSize: 13, fontFamily: "ui-monospace, monospace" }}>
        <ReactJson
          src={settings}
          theme={themeMode === "dark" ? "monokai" : "rjv-default"}
          collapsed={false}
          displayDataTypes={false}
          displayObjectSize={false}
          enableClipboard={false}
          onEdit={(args) => handleEdit(args.updated_src as Partial<Settings>)}
          onAdd={(args) => handleEdit(args.updated_src as Partial<Settings>)}
          onDelete={(args) => handleEdit(args.updated_src as Partial<Settings>)}
        />
      </Box>
    </FieldCard>
  );
}
