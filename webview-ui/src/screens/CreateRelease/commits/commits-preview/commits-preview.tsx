import {
  Alert,
  Box,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorIcon from "@mui/icons-material/Error";
import type { ResolvedCommitItem } from "../../../../types";
import { FlexBox } from "../../../../components/ui/flex-box";
import {
  useApplyCommits,
  type ApplyMode,
  type CommitApplyStatus,
  type SkipReason,
} from "./use-apply-commits";

type Commit = ResolvedCommitItem & {
  sha: string;
};

export interface CommitsPreviewProps {
  /** Разрешённые коммиты для добавления в релиз. */
  commits: Commit[];
  /** Идёт ли запрос к хосту. */
  loading: boolean;
  /** Сообщение об ошибке (когда сам запрос провалился). */
  error: string | null;
  /** Исходные query, которые не удалось сопоставить коммиту. */
  notFound: string[];
  title: string;
  /** Целевая ветка (релизная ветка из Шага 1). */
  branch?: string;
  /** Режим применения: "pick" — cherry-pick (добавление), "revert" — удаление. */
  mode?: ApplyMode;
}

/** Подпись причины пропуска пункта. */
function skipLabel(reason?: SkipReason): string {
  if (reason === "in-branch") return " · уже в ветке";
  if (reason === "empty-patch") return " · изменения уже применены";
  return "";
}

/** Индикатор статуса применения одного пункта списка. */
function StatusIcon({ status }: { status?: CommitApplyStatus }) {
  switch (status) {
    case "in-progress":
      return <CircularProgress size={14} />;
    case "done":
      return <CheckIcon fontSize="small" color="success" />;
    case "skipped":
      return <DoneAllIcon fontSize="small" color="info" />;
    case "conflict":
      return <WarningAmberIcon fontSize="small" color="warning" />;
    case "error":
      return <ErrorIcon fontSize="small" color="error" />;
    default:
      return null;
  }
}

/**
 * Правая панель экрана коммитов — список реальных коммитов, разрешённых из
 * введённых пользователем query (SHA/сообщения) на стороне хоста.
 *
 * Кнопка «Применить» запускает пошаговый cherry-pick на текущую релизную
 * ветку (см. `useApplyCommits`): каждый пункт получает статус — loader на
 * активном, галочка на пройденном, предупреждение на конфликте. При конфликте
 * процесс останавливается и ждёт ручного резолва в VS Code (Source Control),
 * после чего нажимается «Заново» — применение перезапускается с первого
 * пункта, хост сам доводит незавершённый cherry-pick.
 */
export function CommitsPreview({
  commits,
  loading,
  error,
  notFound,
  title,
  branch,
  mode,
}: CommitsPreviewProps) {
  const {
    statuses,
    phase,
    conflictFiles,
    error: applyError,
    applyBranch,
    skipReasons,
    apply,
    restart,
    abort,
    openConflicts,
  } = useApplyCommits(commits, branch, mode);

  const isEmpty =
    !loading && !error && commits.length === 0 && notFound.length === 0;

  if (isEmpty) {
    return (
      <Box sx={{ padding: "10px", width: "100%" }}>
        <Typography variant="body2" color="text.secondary">
          Нажмите «Добавить», чтобы загрузить коммиты.
        </Typography>
      </Box>
    );
  }

  const canApply = phase === "idle" || phase === "error";

  return (
    <Box sx={{ padding: "10px", width: "100%" }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
      >
        <Typography variant="h6">{title}</Typography>
        {commits.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {commits.length} шт.
          </Typography>
        )}
      </Stack>

      {(branch || applyBranch) && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
          Применяется на: {applyBranch ?? branch}
        </Typography>
      )}

      {loading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Резолвим коммиты…
          </Typography>
        </Stack>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && notFound.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Не найдено: {notFound.join(", ")}
        </Alert>
      )}

      <FlexBox
        sx={{
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "10px",
        }}
      >
        {!loading && !error && commits.length > 0 && (
          <List
            dense
            disablePadding
            sx={{
              width: "100%",
            }}
          >
            {commits.map((commit) => (
              <ListItem
                key={commit.sha}
                divider
                sx={{ py: 0.5, px: 0 }}
                secondaryAction={
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <StatusIcon status={statuses[commit.sha]} />
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: "ui-monospace, monospace" }}
                      color="text.secondary"
                    >
                      {commit.shortSha}
                    </Typography>
                  </Stack>
                }
              >
                <ListItemText
                  primary={
                    <Typography variant="body2">{commit.message}</Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {commit.author} ·{" "}
                      {new Date(commit?.date || "").toLocaleString()}
                      {skipLabel(skipReasons[commit.sha])}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}

        {phase === "conflict" && (
          <Alert severity="warning" sx={{ width: "100%" }}>
            <Typography variant="body2">
              Конфликт при применении{" "}
              {commits.find((c) => statuses[c.sha] === "conflict")?.shortSha ??
                "коммита"}
              . Разрешите конфликт во вкладке Source Control (застейджите
              файлы или закоммитьте — как удобно), затем нажмите «Заново» —
              применение продолжится.
            </Typography>
            {conflictFiles.length > 0 && (
              <Typography variant="caption" component="div">
                Файлы: {conflictFiles.join(", ")}
              </Typography>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                type="button"
                onClick={openConflicts}
              >
                Открыть конфликты
              </Button>
              <Button
                size="small"
                variant="contained"
                type="button"
                onClick={restart}
              >
                Заново
              </Button>
              <Button
                size="small"
                color="error"
                type="button"
                onClick={abort}
              >
                Прервать
              </Button>
            </Stack>
          </Alert>
        )}

        {phase === "error" && applyError && (
          <Alert severity="error" sx={{ width: "100%" }}>
            {applyError}
          </Alert>
        )}

        {commits.length > 0 && (
          <Button
            variant="contained"
            type="button"
            disabled={loading || !canApply}
            sx={{ textTransform: "none" }}
            onClick={apply}
            size="small"
          >
            {phase === "running" ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              "Применить"
            )}
          </Button>
        )}
      </FlexBox>
    </Box>
  );
}
