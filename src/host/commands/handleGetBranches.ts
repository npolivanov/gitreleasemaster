import { safeListBranches } from "../branches";
import type { HandlerDeps } from "../messages";

/**
 * Обработчик команд `getBranches` и `refreshBranches`.
 *
 * Запрашивает актуальный список релизных веток и отправляет его в вебвюй
 * как событие `branchesUpdated`. Логика одинакова для обеих команд: разница
 * лишь в том, что `refreshBranches` подразумевает ручное обновление.
 */
export async function handleGetBranches(_deps: HandlerDeps): Promise<void> {
  const result = await safeListBranches();
  _deps.panel.webview.postMessage({
    command: "branchesUpdated",
    data: result,
  });
}
