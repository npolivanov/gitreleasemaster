import { safeCherryPickContinue } from "../branches";
import type { CherryPickContinueResult } from "../../git";
import type { HandlerDeps } from "../messages";

/**
 * Обработчик команды `cherryPickContinue`.
 *
 * Завершает прерванный конфликтом cherry-pick (`git cherry-pick --continue`)
 * после того, как пользователь разрешил конфликт в VS Code. Результат уходит
 * в вебвюй как `cherryPickContinueResult` (applied / conflict / error).
 *
 * try/catch гарантирует ответ в любом случае — вечный loader невозможен.
 */
export async function handleCherryPickContinue(
  deps: HandlerDeps,
): Promise<void> {
  let result: CherryPickContinueResult;
  try {
    result = await safeCherryPickContinue();
  } catch (err) {
    result = {
      status: "error",
      files: [],
      message: `Неожиданная ошибка: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  console.log(
    `[Git Release Master] cherryPickContinue: ${result.status}` +
      (result.status === "conflict" ? ` (файлов: ${result.files.length})` : ""),
  );

  deps.panel.webview.postMessage({
    command: "cherryPickContinueResult",
    data: result,
  });
}
