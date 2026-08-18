import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { FlexBox } from "../../components/ui/flex-box";
import { useBranchLog } from "./use-branch-log";

export interface BranchLogButtonProps {
  /** Ветка, лог которой показываем. */
  branch?: string;
}

/**
 * Переиспользуемая кнопка «Логи ветки» + popup со списком коммитов ветки.
 *
 * Первая страница — 20 коммитов; следующие подгружаются по кнопке со
 * стрелкой вниз (см. `useBranchLog`). Закрытие — крестик в заголовке
 * диалога или клик по подложке/Esc (стандартное поведение Dialog).
 *
 * Форм-агностичный компонент: достаточно имени ветки. Используется на экране
 * коммитов (логи релизной ветки) и на Home (логи каждой ветки списка).
 */
export function BranchLogButton({ branch }: BranchLogButtonProps) {
  const {
    open,
    commits,
    loading,
    hasMore,
    error,
    openDialog,
    closeDialog,
    loadMore,
  } = useBranchLog(branch);

  return (
    <>
      <Tooltip title={`Логи ветки ${branch ?? ""}`}>
        <span>
          <IconButton
            size="small"
            disabled={!branch}
            onClick={openDialog}
            aria-label="Логи ветки"
          >
            <HistoryIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 1 }}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography variant="subtitle1" noWrap>
              Логи ветки {branch}
            </Typography>
            <IconButton size="small" onClick={closeDialog} aria-label="Закрыть">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          {error && (
            <Box sx={{ p: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}

          {!error && commits.length === 0 && !loading && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ p: 2 }}
            >
              В ветке нет коммитов.
            </Typography>
          )}

          <List dense disablePadding>
            {commits.map((commit) => (
              <ListItem
                key={commit.sha}
                divider
                sx={{ px: 2, py: 0.5 }}
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
                    <Typography variant="body2" noWrap>
                      {commit.message}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {commit.author} ·{" "}
                      {new Date(commit.date).toLocaleString()}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>

          <FlexBox
            sx={{
              justifyContent: "center",
              py: 1.5,
            }}
          >
            {loading ? (
              <CircularProgress size={18} />
            ) : hasMore ? (
              <Button
                size="small"
                variant="outlined"
                type="button"
                onClick={loadMore}
                endIcon={<KeyboardArrowDownIcon />}
                sx={{ textTransform: "none" }}
              >
                Загрузить ещё
              </Button>
            ) : (
              commits.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Это все коммиты
                </Typography>
              )
            )}
          </FlexBox>
        </DialogContent>
      </Dialog>
    </>
  );
}
