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
}));

const Title = styled(Typography)`
  font-size: 16;
  font-weight: 700;
  font-family: "terminal-f4", monospace;
`;

interface TopBarProps {
  language: Language;
  view: "home" | "settings";
  onOpenSettings: () => void;
  onBackHome: () => void;
}

/** Shared app header. Always shows the settings icon (per requirement). */
export function TopBar({
  language,
  view,
  onOpenSettings,
  onBackHome,
}: TopBarProps) {
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
