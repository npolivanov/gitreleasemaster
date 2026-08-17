import { safeRevert } from "../branches";
import type { CherryPickResult } from "../../git";
import type { HandlerDeps, InboundMessage } from "../messages";

/**
 * Обработчик команды `revert` (режим удаления).
 *
 * Удаляет один коммит из релизной ветки `branch` через `git revert --no-edit`.
 * Результат уходит в вебвюй как `revertResult` тем же контрактом, что и
 * cherry-pick (applied/skipped/conflict/error) — webview переиспользует
 * стейт-машину применения.
 *
 * try/catch гарантирует ответ в любом случае — вечный loader невозможен.
 */
export async function handleRevert(
  message: Extract<InboundMessage, { command: "revert" }>,
  deps: HandlerDeps,
): Promise<void> {
  let result: CherryPickResult;
  try {
    result = await safeRevert(message.data.sha, message.data.branch);
  } catch (err) {
    result = {
      sha: message.data.sha,
      status: "error",
      files: [],
      message: `Неожиданная ошибка: ${err instanceof Error ? err.message : String(err)}`,
      branch: message.data.branch ?? "",
    };
  }

  // Диагностика — видна в Output → Extension Host.
  console.log(
    `[Git Release Master] revert ${result.sha.slice(0, 7)} на «${result.branch}»: ${result.status}` +
      (result.status === "conflict"
        ? ` (файлов: ${result.files.length})`
        : result.status === "error"
          ? ` (${result.message.split("\n")[0]})`
          : ""),
  );

  deps.panel.webview.postMessage({
    command: "revertResult",
    data: result,
  });
}
