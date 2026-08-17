import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Box, Button, Divider } from "@mui/material";
import { UnstagedCommitsList } from "./unstaged";
import { CommitsPreview } from "./commits-preview";
import { FlexBox } from "../../../components/ui/flex-box";
import { onMessage, postMessage } from "../../../vscode";
import type { CreateReleaseFormValues, ReleaseContext } from "../types";
import type { ResolvedCommit } from "../../../types";

interface CommitsProps {
  /** Контекст созданной ветки — из Шага 1. Пока информационный. */
  releaseCtx?: ReleaseContext | null;
}

/**
 * Шаг 2 — коммиты для релиза.
 *
 * Левая панель: форма со списком инпутов (SHA или сообщение коммита) +
 * `upstreamBranch` через `SelectBranch` (в `ControlMenu`). В режиме добавления
 * (`isDeleteMode === false`) внизу форма содержит кнопку «Добавить»
 * (`type="submit"`).
 *
 * По «Добавить» webview шлёт `resolveCommits`; хост для каждого query через
 * git находит реальный коммит и возвращает его. Результат отображается в правой
 * панели (`CommitsPreview`). Не найденные query подсвечиваются.
 *
 * В режиме удаления (`isDeleteMode === true`) кнопка «Добавить» скрыта — логика
 * удаления в этой задаче не реализована.
 */
export function Commits({ releaseCtx }: CommitsProps) {
  const { control, register, handleSubmit, watch } =
    useForm<CreateReleaseFormValues>({
      defaultValues: {
        commits: [{ value: "" }],
        isDeleteMode: false,
        upstreamBranch: "",
      },
    });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "commits",
  });

  const handleAdd = () => append({ value: "" });

  const isDeleteMode = watch("isDeleteMode");

  const [resolved, setResolved] = useState<ResolvedCommit>({});
  const [notFound, setNotFound] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Стабильная подписка на ответ хоста (mount-once). Значения берём из refs,
  // чтобы в замыкании не зафиксировать устаревшие state-сеттеры.
  const setErrorRef = useRef(setError);
  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      if (message.command !== "commitsResolved") return;
      const data = message.data;
      setLoading(false);
      if (data.ok) {
        setResolved(data.resolved);
        setNotFound(data.notFound);
        setError(null);
      } else {
        setError(data.message);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setErrorRef.current = setError;
  }, []);

  const onSubmit = (data: CreateReleaseFormValues) => {
    const queries = data.commits
      .map((c) => c.value.trim())
      .filter((v) => v !== "");

    if (queries.length === 0) {
      setError("Введите хотя бы один коммит.");
      return;
    }

    // Ветвь резолва по режиму: добавление — upstream, удаление — сама
    // релизная ветка (удаляем коммиты из неё, значит и ищем в ней).
    const branch = data.isDeleteMode
      ? releaseCtx?.branch
      : data.upstreamBranch;

    if (!branch || branch.trim() === "") {
      setError(
        data.isDeleteMode
          ? "Релизная ветка не определена."
          : "Выберите upstream-ветку.",
      );
      return;
    }

    setError(null);
    setLoading(true);
    postMessage({
      command: "resolveCommits",
      data: { branch, queries },
    });
  };

  // Порядок применения: добавление — от старых к новым; удаление (revert) —
  // от новых к старым (обратный порядок, как при revert из терминала).
  const sortedCommits = useMemo(
    () =>
      Object.entries(resolved)
        ?.map(([sha, commitData]) => ({
          sha,
          ...commitData,
        }))
        ?.sort((a, b) => {
          const diff = new Date(a?.date).getTime() - new Date(b.date).getTime();
          return isDeleteMode ? -diff : diff;
        }),
    [resolved, isDeleteMode],
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FlexBox
        sx={{
          width: "100%",
          justifyContent: "space-around",
        }}
      >
        <Box sx={{ width: "100%" }}>
          <UnstagedCommitsList
            fields={fields}
            register={register}
            remove={remove}
            canRemove={fields.length > 1}
            add={handleAdd}
            control={control}
          />

          <Box sx={{ padding: "0 10px", mt: 1 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ textTransform: "none" }}
              size="small"
            >
              Добавить
            </Button>
          </Box>
        </Box>

        <Divider orientation="vertical" flexItem />

        {!isDeleteMode && (
          <Box sx={{ width: "100%" }}>
            <CommitsPreview
              commits={sortedCommits}
              loading={loading}
              error={error}
              notFound={notFound}
              title="Коммиты для добавления"
              branch={releaseCtx?.branch}
            />
          </Box>
        )}

        {isDeleteMode && (
          <Box sx={{ width: "100%" }}>
            <CommitsPreview
              commits={sortedCommits}
              loading={loading}
              error={error}
              notFound={notFound}
              title="Коммиты для удаления"
              branch={releaseCtx?.branch}
              mode="revert"
            />
          </Box>
        )}
      </FlexBox>
    </form>
  );
}
