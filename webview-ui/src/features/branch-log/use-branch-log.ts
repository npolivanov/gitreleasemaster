import { useCallback, useEffect, useRef, useState } from "react";
import { onMessage, postMessage } from "../../vscode";
import type { BranchLogEntry } from "../../types";

/** Размер страницы лога. */
const PAGE_SIZE = 20;

export interface UseBranchLogResult {
  /** Открыт ли popup. */
  open: boolean;
  /** Загруженные записи лога (новые первыми, append по мере нажатий). */
  commits: BranchLogEntry[];
  /** Идёт ли запрос текущей страницы. */
  loading: boolean;
  /** Есть ли коммиты глубже загруженных. */
  hasMore: boolean;
  /** Текст ошибки. */
  error: string | null;
  /** Открыть popup: сброс состояния + первая страница. */
  openDialog: () => void;
  /** Закрыть popup. */
  closeDialog: () => void;
  /** Докгрузить следующую страницу (вызывается кнопкой «Загрузить ещё»). */
  loadMore: () => void;
}

/**
 * Лог ветки с постраничной подгрузкой по кнопке.
 *
 * `openDialog()` сбрасывает состояние и запрашивает первую страницу (20 шт.);
 * `loadMore()` запрашивает следующую со `skip = commits.length` — вызывается
 * кнопкой «Загрузить ещё» в диалоге. Подписка mount-once; `loadingRef`
 * гардит от параллельных запросов и отсеивает устаревшие ответы (после
 * переоткрытия popup).
 */
export function useBranchLog(branch?: string): UseBranchLogResult {
  const [open, setOpen] = useState(false);
  const [commits, setCommits] = useState<BranchLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const branchRef = useRef(branch);
  useEffect(() => {
    branchRef.current = branch;
  }, [branch]);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const openRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      if (message.command !== "branchLogLoaded") return;
      if (!loadingRef.current) return; // ответ неактуален (закрыли/переоткрыли)

      const data = message.data;
      loadingRef.current = false;
      setLoading(false);
      if (data.ok) {
        setCommits((prev) => [...prev, ...data.commits]);
        hasMoreRef.current = data.hasMore;
        setHasMore(data.hasMore);
        setError(null);
      } else {
        hasMoreRef.current = false;
        setHasMore(false);
        setError(data.message);
      }
    });
    return unsubscribe;
  }, []);

  /** Запросить страницу со смещением skip. */
  const requestPage = useCallback((skip: number) => {
    loadingRef.current = true;
    setLoading(true);
    postMessage({
      command: "getBranchLog",
      data: { branch: branchRef.current ?? "", skip, limit: PAGE_SIZE },
    });
  }, []);

  const openDialog = useCallback(() => {
    openRef.current = true;
    setOpen(true);
    // Свежий лог при каждом открытии.
    setCommits([]);
    setError(null);
    hasMoreRef.current = true;
    setHasMore(true);
    loadingRef.current = false;
    requestPage(0);
  }, [requestPage]);

  const closeDialog = useCallback(() => {
    openRef.current = false;
    setOpen(false);
  }, []);

  const loadMore = useCallback(() => {
    if (!openRef.current || loadingRef.current || !hasMoreRef.current) return;
    requestPage(commits.length);
  }, [commits.length, requestPage]);

  return {
    open,
    commits,
    loading,
    hasMore,
    error,
    openDialog,
    closeDialog,
    loadMore,
  };
}
