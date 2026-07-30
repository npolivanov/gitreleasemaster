import {
  applySettings,
  readCachedSettings,
} from "../settings";
import type { InboundMessage, HandlerDeps } from "../messages";

/**
 * Обработчик команды `updateSettings`.
 *
 * 1. Сохраняет прежний снимок настроек ДО изменения.
 * 2. Применяет патч: записывает поля в конфигурацию и синхронизирует кэш.
 * 3. Отправляет вебвюю каноничный (после обновления) снимок `settingsUpdated`,
 *    чтобы обе вкладки (General и JSON) показывали одинаковые значения.
 * 4. ★ Если изменился `releasePrefix` — автоматически перевызывает получение
 *    веток, чтобы список отфильтровался по новому префиксу без ручного
 *    нажатия «Обновить». Перевызов шлёт вебвюю свежий `branchesUpdated`.
 */
export async function handleUpdateSettings(
  message: Extract<InboundMessage, { command: "updateSettings" }>,
  deps: HandlerDeps,
): Promise<void> {
  const { context, panel, refreshBranches } = deps;

  // Снимок ДО изменения — нужен, чтобы сравнить префикс после применения.
  const prev = readCachedSettings(context);

  // Применить патч: запись конфига + синхронизация кэша.
  const next = await applySettings(context, message.data);

  // Отправить обновлённые настройки (синхронизация вкладок General/JSON).
  panel.webview.postMessage({
    command: "settingsUpdated",
    data: next,
  });

  // ★ Автоперевызов веток при смене префикса релизных веток.
  if (prev.releasePrefix !== next.releasePrefix) {
    await refreshBranches();
  }
}
