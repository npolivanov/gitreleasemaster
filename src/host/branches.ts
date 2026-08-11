import {
  getWorkspaceCwd,
  listReleaseBranches,
  listAllBranches,
  createReleaseBranch,
  checkoutExistingBranch,
  type ListBranchesResult,
  type BranchSearchResult,
  type CreateBranchResult,
} from "../git";
import { readSettings } from "./settings";

/**
 * Получить список релизных веток с дружелюбной обработкой ошибок.
 *
 * Определяет рабочую папку, берёт актуальный `releasePrefix` из настроек и
 * делегирует реальную работу git-модулю. Если папка не открыта, возвращает
 * понятную ошибку вместо падения.
 */
export async function safeListBranches(): Promise<ListBranchesResult> {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    return {
      ok: false,
      reason: "no-folder",
      message: "Open a folder that contains a Git repository.",
    };
  }
  const { releasePrefix } = readSettings();
  return listReleaseBranches(cwd, releasePrefix);
}

/**
 * Список всех веток репозитория (без префиксного фильтра).
 *
 * Загружается один раз и кэшируется webview'ем для мгновенного клиентского
 * поиска. Если папка не открыта — возвращаем понятную ошибку.
 */
export async function safeListAllBranches(): Promise<BranchSearchResult> {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    return {
      ok: false,
      query: "",
      reason: "no-folder",
      message: "Open a folder that contains a Git repository.",
    };
  }
  return listAllBranches(cwd);
}

/**
 * Создать релизную ветку от `fromBranch` с именем `releasePrefix + releaseName`.
 *
 * Префикс берётся из настроек расширения (единый источник правды) и
 * нормализуется — гарантируется ровно один `/` между префиксом и названием.
 * Если папка не открыта — возвращаем понятную ошибку.
 */
export async function safeCreateReleaseBranch(
  fromBranch: string,
  releaseName: string,
): Promise<CreateBranchResult> {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    return {
      ok: false,
      reason: "git-error",
      message: "Open a folder that contains a Git repository.",
    };
  }
  const { releasePrefix } = readSettings();
  const cleanPrefix = releasePrefix.endsWith("/")
    ? releasePrefix
    : `${releasePrefix}/`;
  const fullBranchName = `${cleanPrefix}${releaseName}`;
  return createReleaseBranch(cwd, fromBranch, fullBranchName);
}

/**
 * Переключиться на существующую ветку `fromBranch` (без создания новой).
 *
 * Используется для режима «Использовать ветку-источник как основную».
 * Если папка не открыта — возвращаем понятную ошибку.
 */
export async function safeUseSourceBranch(
  fromBranch: string,
): Promise<CreateBranchResult> {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    return {
      ok: false,
      reason: "git-error",
      message: "Open a folder that contains a Git repository.",
    };
  }
  return checkoutExistingBranch(cwd, fromBranch);
}
