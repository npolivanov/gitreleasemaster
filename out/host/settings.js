"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHED_SETTINGS_KEY = exports.CONFIG_SECTION = void 0;
exports.readSettings = readSettings;
exports.cacheSettings = cacheSettings;
exports.readCachedSettings = readCachedSettings;
exports.applySettings = applySettings;
const vscode = __importStar(require("vscode"));
/** Секция настроек расширения, объявленная в package.json (contributes.configuration). */
exports.CONFIG_SECTION = "gitreleasemaster";
/**
 * Ключ, под которым последний снимок настроек кэшируется в
 * `context.globalState`. Служит мгновенным резервным слоем: вебвюй получает
 * снимок сразу, не дожидаясь полного разрешения конфигурации, тогда как
 * конфигурация VS Code остаётся каноничным источником правды.
 */
exports.CACHED_SETTINGS_KEY = "gitreleasemaster.cachedSettings";
/**
 * Прочитать все настройки из нашей секции конфигурации.
 * Используется как источник правды и как фолбэк, когда кэш пуст.
 */
function readSettings() {
    const config = vscode.workspace.getConfiguration(exports.CONFIG_SECTION);
    return {
        releasePrefix: config.get("releasePrefix", "release/"),
        theme: config.get("theme", "dark"),
        language: config.get("language", "ru"),
    };
}
/**
 * Сохранить снимок настроек в `globalState`, чтобы он переживал перезапуск
 * VS Code и был доступен мгновенно при следующем открытии панели.
 */
async function cacheSettings(context, settings) {
    await context.globalState.update(exports.CACHED_SETTINGS_KEY, settings);
}
/**
 * Вернуть последний кэшированный снимок настроек. Если кэш пуст
 * (например, при первом запуске), читаем настройки из конфигурации.
 */
function readCachedSettings(context) {
    return (context.globalState.get(exports.CACHED_SETTINGS_KEY) ?? readSettings());
}
/**
 * Применить частичное обновление настроек: записать каждое поле в конфигурацию
 * (глобальный пользовательский уровень), затем синхронизировать кэш актуальным
 * снимком. Возвращает итоговое значение настроек.
 */
async function applySettings(context, patch) {
    // ВАЖНО: getConfiguration(CONFIG_SECTION) уже возвращает секцию "gitreleasemaster",
    // поэтому в config.update ключ указываем БЕЗ префикса секции — только имя поля.
    // Раньше тут было `${CONFIG_SECTION}.${key}`, что превращалось в путь
    // "gitreleasemaster.gitreleasemaster.releasePrefix" — такое значение записывалось
    // во вложенный объект и НЕ читалось обратно через config.get("releasePrefix"),
    // из-за чего настройки выглядели несохранёнными (всегда отдавался дефолт).
    const config = vscode.workspace.getConfiguration(exports.CONFIG_SECTION);
    await Promise.all(Object.entries(patch).map(([key, value]) => config.update(key, value, vscode.ConfigurationTarget.Global)));
    // Конфигурация — источник правды: зеркалим итоговый снимок в кэш.
    const next = readSettings();
    await cacheSettings(context, next);
    return next;
}
//# sourceMappingURL=settings.js.map