import {
  getWorkspaceCwd,
  listReleaseBranches,
  listAllBranches,
  createReleaseBranch,
  checkoutExistingBranch,
  resolveCommits,
  cherryPickCommit,
  cherryPickContinue,
  cherryPickAbort,
  type ListBranchesResult,
  type BranchSearchResult,
  type CreateBranchResult,
  type ResolveCommitsResult,
  type CherryPickResult,
  type CherryPickContinueResult,
  type CherryPickAbortResult,
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

/**
 * Разрешить список query (SHA/сообщения) в реальные коммиты репозитория.
 *
 * Используется для наполнения правой панели экрана коммитов. Если папка не
 * открыта — возвращаем понятную ошибку.
 */
export async function safeResolveCommits(
  upstreamBranch: string,
  queries: string[],
): Promise<ResolveCommitsResult> {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    return {
      ok: false,
      reason: "no-folder",
      message: "Open a folder that contains a Git repository.",
    };
  }
  return resolveCommits(cwd, upstreamBranch, queries);
}

/**
 * Применить один коммит через cherry-pick на ветку `branch`.
 *
 * Если `branch` задан и не является текущей — хост переключится на неё перед
 * применением. Если папка не открыта — возвращаем ошибку в формате результата.
 */
export async function safeCherryPick(
  sha: string,
  branch?: string,
): Promise<CherryPickResult> {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    return {
      sha,
      status: "error",
      files: [],
      message: "Open a folder that contains a Git repository.",
      branch: "",
    };
  }
  return cherryPickCommit(cwd, sha, branch);
}

/** Завершить cherry-pick после ручного резолва конфликта. */
export async function safeCherryPickContinue(): Promise<CherryPickContinueResult> {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    return {
      status: "error",
      files: [],
      message: "Open a folder that contains a Git repository.",
    };
  }
  return cherryPickContinue(cwd);
}

/** Отменить незавершённый cherry-pick. */
export async function safeCherryPickAbort(): Promise<CherryPickAbortResult> {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    return {
      ok: false,
      message: "Open a folder that contains a Git repository.",
    };
  }
  return cherryPickAbort(cwd);
}
