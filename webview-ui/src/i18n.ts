import type { Language } from "./types";

/** Minimal RU/EN dictionary keyed by string id. */
type Dictionary = Record<string, string>;

const ru: Dictionary = {
  appTitle: "Git Release Master",
  appSubtitle: "Управление релизными ветками",
  search: "Поиск по названию ветки…",
  sortNewest: "Сначала новые",
  sortOldest: "Сначала старые",
  refresh: "Обновить",
  createRelease: "Создать релиз",
  branchesOne: "ветка",
  branchesFew: "ветки",
  branchesMany: "веток",
  emptyNoFolder: "Откройте папку с Git-репозиторием.",
  emptyNoRepo: "Открытая папка не является Git-репозиторием.",
  emptyNoBranches: "Релизных веток не найдено.",
  emptyNoMatch: "Ничего не найдено по запросу.",
  errorTitle: "Ошибка",
  loading: "Загрузка…",
  lastCommit: "Последний коммит",
  author: "Автор",
  sha: "SHA",
  settingsTitle: "Настройки",
  settingsSubtitle: "Конфигурация расширения",
  tabGeneral: "Основные",
  tabJson: "JSON",
  releasePrefix: "Префикс релиза",
  releasePrefixHelp: "Используется для фильтрации веток на главной.",
  theme: "Тема",
  themeDark: "Тёмная",
  themeLight: "Светлая",
  language: "Язык интерфейса",
  back: "Назад",
  jsonHelp: "Изменения сохраняются автоматически.",
  invalidJson: "Недопустимое значение — изменения отменены.",
};

const en: Dictionary = {
  appTitle: "Git Release Master",
  appSubtitle: "Manage your release branches",
  search: "Search branches…",
  sortNewest: "Newest first",
  sortOldest: "Oldest first",
  refresh: "Refresh",
  createRelease: "Create Release",
  branchesOne: "branch",
  branchesFew: "branches",
  branchesMany: "branches",
  emptyNoFolder: "Open a folder containing a Git repository.",
  emptyNoRepo: "The open folder is not a Git repository.",
  emptyNoBranches: "No release branches found.",
  emptyNoMatch: "No branches match your search.",
  errorTitle: "Error",
  loading: "Loading…",
  lastCommit: "Last commit",
  author: "Author",
  sha: "SHA",
  settingsTitle: "Settings",
  settingsSubtitle: "Extension configuration",
  tabGeneral: "General",
  tabJson: "JSON",
  releasePrefix: "Release prefix",
  releasePrefixHelp: "Used to filter branches on the home screen.",
  theme: "Theme",
  themeDark: "Dark",
  themeLight: "Light",
  language: "Interface language",
  back: "Back",
  jsonHelp: "Changes are saved automatically.",
  invalidJson: "Invalid value — change reverted.",
};

const dictionaries: Record<Language, Dictionary> = { ru, en };

/** Resolve a translation key. Falls back to the key itself. */
export function t(language: Language, key: string): string {
  return dictionaries[language]?.[key] ?? key;
}

/** Format a branch count with proper pluralisation for the given language. */
export function formatBranchCount(language: Language, n: number): string {
  if (language === "ru") {
    return `${n} ${pluralRu(n)}`;
  }
  return `${n} ${n === 1 ? en.branchesOne : en.branchesFew}`;
}

function pluralRu(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "ветка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "ветки";
  return "веток";
}
