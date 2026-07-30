"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetSettings = handleGetSettings;
const settings_1 = require("../settings");
/**
 * Обработчик команды `getSettings`.
 *
 * Отдаёт вебвюю кэшированный снимок настроек (мгновенно, без ожидания
 * полного разрешения конфигурации). Фолбэк на чтение конфига происходит
 * внутри `readCachedSettings`, если кэш пуст.
 */
async function handleGetSettings(deps) {
    deps.panel.webview.postMessage({
        command: "settingsUpdated",
        data: (0, settings_1.readCachedSettings)(deps.context),
    });
}
//# sourceMappingURL=handleGetSettings.js.map