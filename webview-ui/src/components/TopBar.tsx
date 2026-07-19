import { IconButton, Stack, Tooltip, Typography } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { styled } from "@mui/material/styles";
import type { Language } from "../types";
import { t } from "../i18n";

const Root = styled(Stack)(({ theme }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${theme.palette.divider}`,
  background: theme.palette.mode === "dark"
    ? "linear-gradient(135deg, rgba(170, 59, 255, 0.12), transparent 60%)"
    : "linear-gradient(135deg, rgba(170, 59, 255, 0.08), transparent 60%)",
}));

const Title = styled(Typography)(({ theme }) => ({
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 0.2,
  background:
    theme.palette.mode === "dark"
      ? "linear-gradient(90deg, #c084fc, #7c9cff)"
      : "linear-gradient(90deg, #aa3bff, #5570ff)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
}));

interface TopBarProps {
  language: Language;
  view: "home" | "settings";
  onOpenSettings: () => void;
  onBackHome: () => void;
}

/** Shared app header. Always shows the settings icon (per requirement). */
export function TopBar({ language, view, onOpenSettings, onBackHome }: TopBarProps) {
  return (
    <Root>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        {view === "settings" && (
          <Tooltip title={t(language, "back")}>
            <IconButton size="small" onClick={onBackHome}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Title>{t(language, "appTitle")}</Title>
      </Stack>
      <Tooltip title={t(language, "settingsTitle")}>
        <IconButton
          size="small"
          onClick={onOpenSettings}
          color={view === "settings" ? "primary" : "default"}
        >
          <SettingsIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Root>
  );
}
