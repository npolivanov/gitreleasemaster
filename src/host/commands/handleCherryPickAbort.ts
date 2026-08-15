import { safeCherryPickAbort } from "../branches";
import type { HandlerDeps } from "../messages";

/**
 * Обработчик команды `cherryPickAbort`.
 *
 * Отменяет незавершённый cherry-pick (`git cherry-pick --abort`). Результат
 * уходит в вебвюй как `cherryPickAborted`. try/catch гарантирует ответ.
 */
export async function handleCherryPickAbort(deps: HandlerDeps): Promise<void> {
  let result: { ok: boolean; message: string };
  try {
    result = await safeCherryPickAbort();
  } catch (err) {
    result = {
      ok: false,
      message: `Неожиданная ошибка: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  console.log(`[Git Release Master] cherryPickAbort: ok=${result.ok}`);

  deps.panel.webview.postMessage({
    command: "cherryPickAborted",
    data: result,
  });
}
