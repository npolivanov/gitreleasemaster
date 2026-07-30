import {
  getWorkspaceCwd,
  listReleaseBranches,
  type ListBranchesResult,
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
