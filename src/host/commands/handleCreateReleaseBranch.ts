import { safeCreateReleaseBranch } from "../branches";
import type { HandlerDeps, InboundMessage } from "../messages";

/**
 * Обработчик команды `createReleaseBranch`.
 *
 * Создаёт релизную ветку от `fromBranch` с именем `releasePrefix + releaseName`
 * и переключается на неё. Результат уходит в вебвюй как `releaseBranchCreated`
 * (успех) или `releaseBranchError` (провал — например, ветка уже существует).
 */
export async function handleCreateReleaseBranch(
  message: Extract<InboundMessage, { command: "createReleaseBranch" }>,
  deps: HandlerDeps,
): Promise<void> {
  // Временная диагностика — видна в Output → Extension Host.
  // Поможет понять, доходит ли запрос и чем заканчивается.
  console.log(
    "[Git Release Master] createReleaseBranch:",
    message.data.fromBranch,
    "->",
    message.data.releaseName,
  );

  const result = await safeCreateReleaseBranch(
    message.data.fromBranch,
    message.data.releaseName,
  );

  console.log("[Git Release Master] createReleaseBranch result:", result);

  if (result.ok) {
    deps.panel.webview.postMessage({ command: "releaseBranchCreated" });
    return;
  }

  deps.panel.webview.postMessage({
    command: "releaseBranchError",
    data: { message: result.message },
  });
}
