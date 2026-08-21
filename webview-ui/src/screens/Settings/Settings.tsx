import { useEffect, useRef, useState } from "react";
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
}

export function SettingsScreen({
  language,
  settings,
  updateSettings,
}: SettingsScreenProps) {
  const [tab, setTab] = useState<0 | 1>(0);

  return (
    <Page>
      <Box>
        {/* Цвета — адаптивные текстовые, а не primary (#212121): в тёмной
            теме primary-индикатор и активный лейбл были бы почти невидимы. */}
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value as 0 | 1)}
          sx={{
            "& .MuiTab-root": { color: "text.secondary" },
            "& .MuiTab-root.Mui-selected": { color: "text.primary" },
            "& .MuiTabs-indicator": { backgroundColor: "text.primary" },
          }}
        >
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
}

/** Каноническая строка настроек с фиксированным порядком ключей — для сравнений. */
function canon(s: Pick<Settings, "releasePrefix" | "theme" | "language">) {
  return JSON.stringify({
    releasePrefix: s.releasePrefix,
    theme: s.theme,
    language: s.language,
  });
}

/** Разобрать и провалидировать текст как полные настройки. */
function parseSettings(
  text: string,
): { ok: true; value: Settings } | { ok: false; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      message: `Невалидный JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, message: "Ожидался JSON-объект." };
  }
  const o = parsed as Record<string, unknown>;
  if (typeof o.releasePrefix !== "string") {
    return { ok: false, message: "releasePrefix должен быть строкой." };
  }
  if (o.theme !== "dark" && o.theme !== "light") {
    return { ok: false, message: 'theme должен быть "dark" или "light".' };
  }
  if (o.language !== "ru" && o.language !== "en") {
    return { ok: false, message: 'language должен быть "ru" или "en".' };
  }
  return {
    ok: true,
    value: {
      releasePrefix: o.releasePrefix,
      theme: o.theme,
      language: o.language,
    },
  };
}

function JsonTab({ language, settings, updateSettings }: JsonTabProps) {
  const [text, setText] = useState(() => JSON.stringify(settings, null, 2));
  const [error, setError] = useState<string | null>(null);

  // Последнее применённое значение — чтобы эхо хоста (settingsUpdated) не
  // перезатирало текст, который мы сами только что отправили.
  const lastAppliedRef = useRef(canon(settings));

  // Внешнее изменение настроек (General-таб или конфиг VS Code) — обновляем текст.
  useEffect(() => {
    if (canon(settings) !== lastAppliedRef.current) {
      lastAppliedRef.current = canon(settings);
      setText(JSON.stringify(settings, null, 2));
      setError(null);
    }
  }, [settings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setText(next);

    const parsed = parseSettings(next);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setError(null);
    if (canon(parsed.value) !== lastAppliedRef.current) {
      lastAppliedRef.current = canon(parsed.value);
      updateSettings(parsed.value);
    }
  };

  return (
    <FieldCard elevation={0} variant="outlined">
      <FieldHelp sx={{ mt: 0, mb: 1.5 }}>{t(language, "jsonHelp")}</FieldHelp>
      <TextField
        fullWidth
        multiline
        minRows={10}
        maxRows={24}
        size="small"
        value={text}
        onChange={handleChange}
        error={!!error}
        helperText={error ?? " "}
        spellCheck={false}
        sx={{
          "& .MuiInputBase-input": {
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
          },
        }}
      />
    </FieldCard>
  );
}
