import { safeResolveCommits } from "../branches";
import type { HandlerDeps, InboundMessage } from "../messages";

/**
 * Обработчик команды `resolveCommits`.
 *
 * Разрешает каждый введённый query (SHA или подстрока сообщения) в реальный
 * коммит репозитория и отправляет результат в вебвюй как `commitsResolved`.
 * Найденные коммиты — в `data.resolved`, не найденные query — в `data.notFound`
 * (чтобы UI мог их подсветить).
 */
export async function handleResolveCommits(
  message: Extract<InboundMessage, { command: "resolveCommits" }>,
  deps: HandlerDeps,
): Promise<void> {
  const result = await safeResolveCommits(
    message.data.branch,
    message.data.queries,
  );

  deps.panel.webview.postMessage({
    command: "commitsResolved",
    data: result,
  });
}
