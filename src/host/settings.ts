import * as vscode from "vscode";

/** Секция настроек расширения, объявленная в package.json (contributes.configuration). */
export const CONFIG_SECTION = "gitreleasemaster";

/**
 * Ключ, под которым последний снимок настроек кэшируется в
 * `context.globalState`. Служит мгновенным резервным слоем: вебвюй получает
 * снимок сразу, не дожидаясь полного разрешения конфигурации, тогда как
 * конфигурация VS Code остаётся каноничным источником правды.
 */
export const CACHED_SETTINGS_KEY = "gitreleasemaster.cachedSettings";

/** Форма объекта настроек, общего с вебвуем. */
export interface Settings {
  /** Префикс имени релизных веток, например "release/". */
  releasePrefix: string;
  /** Тема оформления вебвюя. */
  theme: "dark" | "light";
  /** Язык интерфейса вебвюя. */
  language: "ru" | "en";
}

/**
 * Прочитать все настройки из нашей секции конфигурации.
 * Используется как источник правды и как фолбэк, когда кэш пуст.
 */
export function readSettings(): Settings {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    releasePrefix: config.get<string>("releasePrefix", "release/"),
    theme: config.get<"dark" | "light">("theme", "dark"),
    language: config.get<"ru" | "en">("language", "ru"),
  };
}

/**
 * Сохранить снимок настроек в `globalState`, чтобы он переживал перезапуск
 * VS Code и был доступен мгновенно при следующем открытии панели.
 */
export async function cacheSettings(
  context: vscode.ExtensionContext,
  settings: Settings,
): Promise<void> {
  await context.globalState.update(CACHED_SETTINGS_KEY, settings);
}

/**
 * Вернуть последний кэшированный снимок настроек. Если кэш пуст
 * (например, при первом запуске), читаем настройки из конфигурации.
 */
export function readCachedSettings(
  context: vscode.ExtensionContext,
): Settings {
  return (
    context.globalState.get<Settings>(CACHED_SETTINGS_KEY) ?? readSettings()
  );
}

/**
 * Применить частичное обновление настроек: записать каждое поле в конфигурацию
 * (глобальный пользовательский уровень), затем синхронизировать кэш актуальным
 * снимком. Возвращает итоговое значение настроек.
 */
export async function applySettings(
  context: vscode.ExtensionContext,
  patch: Partial<Settings>,
): Promise<Settings> {
  // ВАЖНО: getConfiguration(CONFIG_SECTION) уже возвращает секцию "gitreleasemaster",
  // поэтому в config.update ключ указываем БЕЗ префикса секции — только имя поля.
  // Раньше тут было `${CONFIG_SECTION}.${key}`, что превращалось в путь
  // "gitreleasemaster.gitreleasemaster.releasePrefix" — такое значение записывалось
  // во вложенный объект и НЕ читалось обратно через config.get("releasePrefix"),
  // из-за чего настройки выглядели несохранёнными (всегда отдавался дефолт).
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  await Promise.all(
    Object.entries(patch).map(([key, value]) =>
      config.update(key, value, vscode.ConfigurationTarget.Global),
    ),
  );
  // Конфигурация — источник правды: зеркалим итоговый снимок в кэш.
  const next = readSettings();
  await cacheSettings(context, next);
  return next;
}
