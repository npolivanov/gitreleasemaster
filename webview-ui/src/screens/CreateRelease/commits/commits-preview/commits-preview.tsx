import {
  Alert,
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import type { ResolvedCommit } from "../../../../types";

export interface CommitsPreviewProps {
  /** Разрешённые коммиты для добавления в релиз. */
  commits: ResolvedCommit;
  /** Идёт ли запрос к хосту. */
  loading: boolean;
  /** Сообщение об ошибке (когда сам запрос провалился). */
  error: string | null;
  /** Исходные query, которые не удалось сопоставить коммиту. */
  notFound: string[];
  title: string;
}

/**
 * Правая панель экрана коммитов — список реальных коммитов, разрешённых из
 * введённых пользователем query (SHA/сообщения) на стороне хоста.
 *
 * Чисто презентационный компонент: все данные приходят через пропсы, никакого
 * своего состояния. Состояния загрузки/ошибки/не-найдено отображаются явно.
 */
export function CommitsPreview({
  commits,
  loading,
  error,
  notFound,
  title,
}: CommitsPreviewProps) {
  const preparedCommits = Object.entries(commits).map(([key, values]) => {
    return {
      sha: key,
      ...values,
    };
  });
  const isEmpty =
    !loading && !error && preparedCommits.length === 0 && notFound.length === 0;

  return (
    <Box sx={{ padding: "10px", width: "100%" }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
      >
        <Typography variant="h6">{title}</Typography>
        {preparedCommits.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {preparedCommits.length} шт.
          </Typography>
        )}
      </Stack>

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

      {!loading && !error && preparedCommits.length > 0 && (
        <List dense disablePadding>
          {preparedCommits.map((commit) => (
            <ListItem
              key={commit.sha}
              divider
              sx={{ py: 0.5, px: 0 }}
              secondaryAction={
                <Typography
                  variant="caption"
                  sx={{ fontFamily: "ui-monospace, monospace" }}
                  color="text.secondary"
                >
                  {commit.shortSha}
                </Typography>
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
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
      )}

      {isEmpty && (
        <Typography variant="body2" color="text.secondary">
          Нажмите «Добавить», чтобы загрузить коммиты.
        </Typography>
      )}
    </Box>
  );
}
