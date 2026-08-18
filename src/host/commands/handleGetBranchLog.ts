import { safeListBranchLog } from "../branches";
import type { BranchLogResult } from "../../git";
import type { HandlerDeps, InboundMessage } from "../messages";

/**
 * Обработчик команды `getBranchLog`.
 *
 * Отдаёт страницу лога ветки (новые коммиты первыми) для popup с ленивой
 * подгрузкой: `skip` — сколько уже показано, `limit` — размер страницы.
 * Результат уходит в вебвюй как `branchLogLoaded`.
 *
 * try/catch гарантирует ответ в любом случае.
 */
export async function handleGetBranchLog(
  message: Extract<InboundMessage, { command: "getBranchLog" }>,
  deps: HandlerDeps,
): Promise<void> {
  let result: BranchLogResult;
  try {
    result = await safeListBranchLog(
      message.data.branch,
      message.data.skip,
      message.data.limit,
    );
  } catch (err) {
    result = {
      ok: false,
      message: `Неожиданная ошибка: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  console.log(
    `[Git Release Master] getBranchLog «${message.data.branch}» skip=${message.data.skip}: ` +
      (result.ok
        ? `${result.commits.length} шт., hasMore=${result.hasMore}`
        : `ошибка: ${result.message.split("\n")[0]}`),
  );

  deps.panel.webview.postMessage({
    command: "branchLogLoaded",
    data: result,
  });
}
