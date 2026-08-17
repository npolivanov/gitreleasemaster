import { safeRevertAbort } from "../branches";
import type { HandlerDeps } from "../messages";

/**
 * Обработчик команды `revertAbort`.
 *
 * Отменяет незавершённый revert (`git revert --abort`). Результат уходит в
 * вебвюй как `revertAborted`. try/catch гарантирует ответ.
 */
export async function handleRevertAbort(deps: HandlerDeps): Promise<void> {
  let result: { ok: boolean; message: string };
  try {
    result = await safeRevertAbort();
  } catch (err) {
    result = {
      ok: false,
      message: `Неожиданная ошибка: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  console.log(`[Git Release Master] revertAbort: ok=${result.ok}`);

  deps.panel.webview.postMessage({
    command: "revertAborted",
    data: result,
  });
}
