import { useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import FilterListIcon from "@mui/icons-material/FilterList";
import { styled } from "@mui/material/styles";
import type { BranchInfo, Language } from "../types";
import { useBranches } from "../hooks/useBranches";
import { postMessage } from "../vscode";
import { t } from "../i18n";

const Page = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
}));

const Toolbar = styled(Stack)(({ theme }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: theme.spacing(1.5),
  flexWrap: "wrap",
}));

const SearchField = styled(TextField)({
  flexGrow: 1,
  minWidth: 220,
});

const BranchPaper = styled(Paper)(({ theme }) => ({
  background: theme.palette.mode === "dark" ? "#1c1d24" : "#fff",
  overflow: "hidden",
}));

const EmptyState = styled(Stack)(({ theme }) => ({
  padding: theme.spacing(8, 2),
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing(1),
  color: theme.palette.text.secondary,
}));

type SortKey = "newest" | "oldest";

interface HomeScreenProps {
  language: Language;
}

export function HomeScreen({ language }: HomeScreenProps) {
  const { loading, result, refresh } = useBranches();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  const visible = useMemo<BranchInfo[]>(() => {
    if (!result?.ok) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? result.branches.filter((b) => b.name.toLowerCase().includes(q))
      : result.branches;
    const sorted = [...filtered].sort((a, b) => {
      const diff =
        new Date(a.lastCommitDate).getTime() -
        new Date(b.lastCommitDate).getTime();
      return sort === "newest" ? -diff : diff;
    });
    return sorted;
  }, [result, query, sort]);

  const handleCreate = () => postMessage({ command: "noopCreateRelease" });

  return (
    <Page>
      <Toolbar>
        <SearchField
          size="small"
          placeholder={t(language, "search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          size="small"
          select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          sx={{ minWidth: 180 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <FilterListIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        >
          <MenuItem value="newest">{t(language, "sortNewest")}</MenuItem>
          <MenuItem value="oldest">{t(language, "sortOldest")}</MenuItem>
        </TextField>
        <Tooltip title={t(language, "refresh")}>
          <IconButton size="small" onClick={refresh} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleCreate}
          sx={{
            borderRadius: 2,
            textTransform: "none",
            background: "linear-gradient(90deg, #aa3bff, #5570ff)",
            boxShadow: "none",
            "&:hover": { boxShadow: "none", opacity: 0.92 },
          }}
        >
          {t(language, "createRelease")}
        </Button>
      </Toolbar>

      {result && !result.ok && (
        <Alert severity="error" variant="outlined">
          {result.message}
        </Alert>
      )}

      <BranchPaper elevation={0} variant="outlined">
        {loading && visible.length === 0 ? (
          <EmptyState>
            <CircularProgress size={28} />
            <Typography variant="body2">{t(language, "loading")}</Typography>
          </EmptyState>
        ) : result && !result.ok ? (
          <EmptyState>
            <Typography variant="body2">
              {result.reason === "no-folder"
                ? t(language, "emptyNoFolder")
                : result.reason === "not-a-repo"
                  ? t(language, "emptyNoRepo")
                  : result.message}
            </Typography>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState>
            <Typography variant="body2">
              {query ? t(language, "emptyNoMatch") : t(language, "emptyNoBranches")}
            </Typography>
          </EmptyState>
        ) : (
          <List disablePadding>
            {visible.map((branch) => (
              <BranchRow
                key={branch.name}
                branch={branch}
                language={language}
              />
            ))}
          </List>
        )}
      </BranchPaper>
    </Page>
  );
}

interface BranchRowProps {
  branch: BranchInfo;
  language: Language;
}

function BranchRow({ branch, language }: BranchRowProps) {
  const date = new Date(branch.lastCommitDate);
  const dateLabel = date.toLocaleString(language === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <ListItem
      divider
      sx={{
        transition: "background 0.15s",
        "&:hover": { background: "action.hover" },
      }}
    >
      <ListItemAvatar>
        <Avatar
          sx={{
            width: 36,
            height: 36,
            bgcolor: "transparent",
            color: "text.secondary",
            border: (theme) => `1px solid ${theme.palette.divider}`,
            fontSize: 14,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {branch.sha.slice(0, 2).toUpperCase()}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>
            {branch.name}
          </Typography>
        }
        secondary={
          <Typography variant="caption" color="text.secondary">
            {t(language, "author")}: {branch.author} · {t(language, "sha")}:{" "}
            {branch.sha.slice(0, 7)} · {dateLabel}
          </Typography>
        }
      />
    </ListItem>
  );
}
