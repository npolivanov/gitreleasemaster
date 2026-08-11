import { safeListAllBranches } from "../branches";
import type { HandlerDeps } from "../messages";

/**
 * Обработчик команды `getAllBranches`.
 *
 * Отдаёт вебвую ВСЕ ветки репозитория (без префиксного фильтра и без поиска)
 * одним списком как событие `allBranchesLoaded`. Вебвуй кэширует результат и
 * дальше фильтрует его клиентски — мгновенно, без запросов при каждом вводе.
 */
export async function handleGetAllBranches(
  deps: HandlerDeps,
): Promise<void> {
  const result = await safeListAllBranches();
  deps.panel.webview.postMessage({
    command: "allBranchesLoaded",
    data: result,
  });
}
