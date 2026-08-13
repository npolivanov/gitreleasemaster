/** Shared types for the Git Release Master webview. */

export interface BranchInfo {
  name: string;
  /** ISO date string of the last commit on the branch. */
  lastCommitDate: string;
  /** Author of the last commit. */
  author: string;
  /** Short SHA of the last commit. */
  sha: string;
}

export type ListBranchesResult =
  | { ok: true; branches: BranchInfo[] }
  | {
      ok: false;
      reason: "no-folder" | "not-a-repo" | "git-error";
      message: string;
    };

/** Минимальная инфа о ветке — используется в результатах поиска. */
export type BranchOption = Pick<BranchInfo, "name" | "sha">;

/**
 * Результат поиска веток по подстроке во всём репозитории.
 *
 * `query` — эхо запроса, чтобы webview мог отсеять устаревшие ответы
 * (пользователь мог успеть напечатать что-то новое, пока хост отвечал).
 */
export type BranchSearchResult =
  | { ok: true; query: string; branches: BranchOption[] }
  | {
      ok: false;
      query: string;
      reason: "no-folder" | "not-a-repo" | "git-error";
      message: string;
    };

export type ThemeMode = "dark" | "light";
export type Language = "ru" | "en";

export interface Settings {
  releasePrefix: string;
  theme: ThemeMode;
  language: Language;
}

export interface ResolvedCommitItem {
  /** Короткий SHA (первые 7 симв.). */
  shortSha: string;
  /** Первая строка сообщения коммита. */
  message: string;
  /** Автор коммита. */
  author: string;
  /** ISO-дата коммита. */
  date: string;
}

/** Реальный коммит, разрешённый из введённого пользователем query (SHA/сообщение). */
export type ResolvedCommit = Record<string, Partial<ResolvedCommitItem>>;

/**
 * Результат разрешения списка коммитов.
 *
 * `notFound` содержит исходные query, которые не удалось сопоставить коммиту.
 */
export type ResolveCommitsResult =
  | { ok: true; resolved: ResolvedCommit; notFound: string[] }
  | { ok: false; message: string };

/** Messages sent from the webview to the extension host. */
export type OutboundMessage =
  | { command: "getBranches" }
  | { command: "refreshBranches" }
  | { command: "getAllBranches" }
  | {
      command: "createReleaseBranch";
      data: { fromBranch: string; releaseName: string };
    }
  | { command: "useSourceBranch"; data: { fromBranch: string } }
  | {
      command: "resolveCommits";
      data: { upstreamBranch: string; queries: string[] };
    }
  | { command: "getSettings" }
  | { command: "updateSettings"; data: Partial<Settings> }
  | { command: "noopCreateRelease" };

/** Messages sent from the extension host to the webview. */
export type InboundMessage =
  | { command: "branchesUpdated"; data: ListBranchesResult }
  | { command: "allBranchesLoaded"; data: BranchSearchResult }
  | { command: "releaseBranchCreated" }
  | { command: "releaseBranchError"; data: { message: string } }
  | { command: "commitsResolved"; data: ResolveCommitsResult }
  | { command: "settingsUpdated"; data: Settings };
