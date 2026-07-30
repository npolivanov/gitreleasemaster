import { readCachedSettings } from "../settings";
import type { HandlerDeps } from "../messages";

/**
 * Обработчик команды `getSettings`.
 *
 * Отдаёт вебвюю кэшированный снимок настроек (мгновенно, без ожидания
 * полного разрешения конфигурации). Фолбэк на чтение конфига происходит
 * внутри `readCachedSettings`, если кэш пуст.
 */
export async function handleGetSettings(deps: HandlerDeps): Promise<void> {
  deps.panel.webview.postMessage({
    command: "settingsUpdated",
    data: readCachedSettings(deps.context),
  });
}
