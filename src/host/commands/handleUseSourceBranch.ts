import { safeUseSourceBranch } from "../branches";
import type { HandlerDeps, InboundMessage } from "../messages";

/**
 * Обработчик команды `useSourceBranch`.
 *
 * Просто переключается на `fromBranch` (без создания новой ветки) — для режима
 * «Использовать ветку-источник как основную». Результат уходит в вебвюй теми
 * же событиями, что и при создании ветки: `releaseBranchCreated` (успех) или
 * `releaseBranchError` (провал).
 */
export async function handleUseSourceBranch(
  message: Extract<InboundMessage, { command: "useSourceBranch" }>,
  deps: HandlerDeps,
): Promise<void> {
  const result = await safeUseSourceBranch(message.data.fromBranch);

  if (result.ok) {
    deps.panel.webview.postMessage({ command: "releaseBranchCreated" });
    return;
  }

  deps.panel.webview.postMessage({
    command: "releaseBranchError",
    data: { message: result.message },
  });
}
