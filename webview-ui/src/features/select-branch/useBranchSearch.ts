import { useEffect, useRef, useState } from "react";
import type { BranchOption } from "../../types";
import { onMessage, postMessage } from "../../vscode";

export interface UseBranchSearchResult {
  /** Полный список веток репозитория (кэш с хоста). */
  allBranches: BranchOption[];
  /** Текущее значение поля ввода — нужно только для текста noOptions. */
  query: string;
  /** Обновить текст инпута. На сам поиск не влияет — фильтрует Autocomplete. */
  setQuery: (next: string) => void;
  /** Идёт ли первичная загрузка списка веток с хоста. */
  loading: boolean;
}

/**
 * Один раз загружает ВСЕ ветки репозитория с хоста и кэширует их.
 *
 * Дальнейший поиск/фильтрация идут клиентски (в MUI Autocomplete через дефолтный
 * `filterOptions`) — это мгновенно, без round-trip через postMessage при каждом
 * нажатии клавиши. Поэтому `query` здесь хранится только ради текста
 * «нет вариантов», а в фильтрацию не участвует.
 *
 * `requestedRef` гарантирует, что запрос уйдёт ровно один раз, даже если
 * React.StrictMode в dev перемонтирует компонент (mount → unmount → mount).
 */
export function useBranchSearch(): UseBranchSearchResult {
  const [allBranches, setAllBranches] = useState<BranchOption[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const requestedRef = useRef(false);

  useEffect(() => {
    // StrictMode в dev вызывает эффект дважды — не шлём дубль запроса.
    if (requestedRef.current) return;
    requestedRef.current = true;

    postMessage({ command: "getAllBranches" });
    const unsubscribe = onMessage((message) => {
      if (message.command !== "allBranchesLoaded") return;
      setLoading(false);
      if (message.data.ok) {
        setAllBranches(message.data.branches);
      }
    });
    return unsubscribe;
  }, []);

  return { allBranches, query, setQuery, loading };
}
