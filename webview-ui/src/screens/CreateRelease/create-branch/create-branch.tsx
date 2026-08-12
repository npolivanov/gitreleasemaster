import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { SelectBranch } from "../../../features/select-branch";
import { useAppStore } from "../../../state-manager/store";
import { onMessage, postMessage } from "../../../vscode";
import type { ReleaseContext } from "../types";

interface Step1CreateBranchProps {
  /** Вызывается после успешного создания ветки — переключает wizard на Шаг 2. */
  onCreated: (ctx: ReleaseContext) => void;
}

/**
 * Шаг 1 — форма создания релизной ветки.
 *
 * Центрированная форма с двумя полями:
 *   1. `parentBranch` — выбирается через переиспользуемый `SelectBranch`.
 *   2. `releaseName` — вводится с префиксом `releasePrefix` из настроек
 *      (слеши и пробелы вырезаются на лету).
 *
 * По кнопке «Далее» webview шлёт `createReleaseBranch`; хост склеивает
 * `releasePrefix + releaseName`, делает `git checkout -b` от `parentBranch` и
 * отвечает `releaseBranchCreated` (переход на Шаг 2) либо `releaseBranchError`
 * (показ Alert, остаёмся на шаге).
 *
 * Форм-агностично: react-hook-form тут нет — достаточно локального state.
 */
export function CreateBranch({ onCreated }: Step1CreateBranchProps) {
  const releasePrefix = useAppStore((s) => s.settings.releasePrefix);
  // Нормализованный префикс для adornment'а — всегда с `/` на конце.
  const adornment = releasePrefix.endsWith("/")
    ? releasePrefix
    : `${releasePrefix}/`;

  const [parentBranch, setParentBranch] = useState("");
  const [releaseName, setReleaseName] = useState("");
  /** Использовать ветку-источник как основную: не создавать новую, просто checkout. */
  const [useSource, setUseSource] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Слушатель ответов хоста должен жить всё время монтирования компонента.
  // Поэтому подписка создаётся один раз (пустой deps-массив), а актуальные
  // значения parentBranch/releaseName/useSource/onCreated берутся из refs —
  // иначе в замыкании зафиксируются пустые строки и перехода на Шаг 2 не будет.
  const onCreatedRef = useRef(onCreated);
  const parentBranchRef = useRef(parentBranch);
  const releaseNameRef = useRef(releaseName);
  const useSourceRef = useRef(useSource);
  useEffect(() => {
    onCreatedRef.current = onCreated;
  }, [onCreated]);
  useEffect(() => {
    parentBranchRef.current = parentBranch;
  }, [parentBranch]);
  useEffect(() => {
    releaseNameRef.current = releaseName;
  }, [releaseName]);
  useEffect(() => {
    useSourceRef.current = useSource;
  }, [useSource]);

  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      if (message.command === "releaseBranchCreated") {
        const fromBranch = parentBranchRef.current;
        // В режиме «использовать ветку-источник» releaseName = fromBranch.
        const name = useSourceRef.current ? fromBranch : releaseNameRef.current;
        onCreatedRef.current({ fromBranch, releaseName: name });
        return;
      }
      if (message.command === "releaseBranchError") {
        setError(message.data.message);
        setSubmitting(false);
      }
    });
    return unsubscribe;
  }, []);

  // В режиме «использовать ветку-источник» название релиза не требуется —
  // новая ветка не создаётся, нужен только parentBranch.
  const canSubmit =
    parentBranch.trim() !== "" &&
    (useSource || releaseName.trim() !== "") &&
    !submitting;

  const handleNext = () => {
    setError(null);
    setSubmitting(true);
    if (useSource) {
      // Просто переключиться на ветку-источник, без создания новой.
      postMessage({
        command: "useSourceBranch",
        data: { fromBranch: parentBranch },
      });
      return;
    }
    postMessage({
      command: "createReleaseBranch",
      data: { fromBranch: parentBranch, releaseName },
    });
  };

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        pt: 6,
      }}
    >
      <Stack spacing={2} sx={{ width: "100%", maxWidth: 480 }}>
        <Typography variant="h6">Создание ветки релиза</Typography>

        <SelectBranch
          value={parentBranch}
          onChange={setParentBranch}
          disabled={submitting}
          label="Ветка-источник"
        />

        <TextField
          label="Название релиза"
          value={useSource ? parentBranch : releaseName}
          onChange={(e) => {
            // Запрещаем слеши и пробелы — ветка не должна их содержать.
            const value = e.target.value.replace(/[\/\s]/g, "");
            setReleaseName(value);
          }}
          disabled={submitting || useSource}
          helperText={
            useSource
              ? "Используется ветка-источник"
              : `Введите название после префикса ${adornment}`
          }
          slotProps={{
            input: {
              startAdornment: useSource ? undefined : (
                <InputAdornment position="start">
                  <Box component="span" sx={{ color: "text.secondary" }}>
                    {adornment}
                  </Box>
                </InputAdornment>
              ),
            },
          }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={useSource}
              disabled={submitting}
              onChange={(e) => {
                const next = e.target.checked;
                setUseSource(next);
                // Сняли чекбокс — вернуть поля в дефолтное состояние.
                if (!next) {
                  setReleaseName("");
                }
              }}
            />
          }
          label="Использовать ветку-источник как основную"
        />

        {error && <Alert severity="error">{error}</Alert>}

        <Button
          variant="contained"
          disabled={!canSubmit}
          onClick={handleNext}
          sx={{ textTransform: "none", alignSelf: "flex-end" }}
        >
          {submitting ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            "Далее"
          )}
        </Button>
      </Stack>
    </Box>
  );
}
