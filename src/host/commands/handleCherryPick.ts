import { safeCherryPick } from "../branches";
import type { CherryPickResult } from "../../git";
import type { HandlerDeps, InboundMessage } from "../messages";

/**
 * Обработчик команды `cherryPick`.
 *
 * Применяет один коммит на релизную ветку `branch` (хост гарантирует, что она
 * активна). Результат уходит в вебвюй как `cherryPickResult`:
 *   applied — коммит применён;
 *   skipped — коммит уже в ветке (или патч пуст) — пропущен;
 *   conflict — конфликт, файлы в `files`, процесс ждёт ручного резолва;
 *   error — прочая ошибка git.
 *
 * Тело обёрнуто в try/catch: при любом непредвиденном исключении вебвюй
 * гарантированно получает ответ со статусом "error" — вечный loader невозможен.
 */
export async function handleCherryPick(
  message: Extract<InboundMessage, { command: "cherryPick" }>,
  deps: HandlerDeps,
): Promise<void> {
  let result: CherryPickResult;
  try {
    result = await safeCherryPick(message.data.sha, message.data.branch);
  } catch (err) {
    result = {
      sha: message.data.sha,
      status: "error",
      files: [],
      message: `Неожиданная ошибка: ${err instanceof Error ? err.message : String(err)}`,
      branch: message.data.branch ?? "",
    };
  }

  // Диагностика — видна в Output → Extension Host: на какой ветке и чем закончилось.
  console.log(
    `[Git Release Master] cherryPick ${result.sha.slice(0, 7)} на «${result.branch}»: ${result.status}` +
      (result.status === "conflict"
        ? ` (файлов: ${result.files.length})`
        : result.status === "error"
          ? ` (${result.message.split("\n")[0]})`
          : ""),
  );

  deps.panel.webview.postMessage({
    command: "cherryPickResult",
    data: result,
  });
}
