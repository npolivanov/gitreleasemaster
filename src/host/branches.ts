import {
  getWorkspaceCwd,
  listReleaseBranches,
  listAllBranches,
  type ListBranchesResult,
  type BranchSearchResult,
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
