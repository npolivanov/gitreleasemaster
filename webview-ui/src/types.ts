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
export type ResolvedCommit = Record<string, ResolvedCommitItem>;

/**
 * Результат разрешения списка коммитов.
 *
 * `notFound` содержит исходные query, которые не удалось сопоставить коммиту.
 */
export type ResolveCommitsResult =
  | { ok: true; resolved: ResolvedCommit; notFound: string[] }
  | { ok: false; message: string };

/** Результат cherry-pick одного коммита. `sha` — эхо запроса. */
export interface CherryPickResult {
  sha: string;
  status: "applied" | "skipped" | "conflict" | "error";
  /** Конфликтующие файлы (для status === "conflict"). */
  files: string[];
  /** Текст ошибки (для status === "error"). */
  message: string;
  /** Ветка, на которой выполнен cherry-pick. */
  branch: string;
  /** Причина пропуска (для status === "skipped"). */
  skippedReason?: "in-branch" | "empty-patch";
}

/** Результат `cherry-pick --abort`. */
export interface CherryPickAbortResult {
  ok: boolean;
  message: string;
}

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
      data: { branch: string; queries: string[] };
    }
  | { command: "cherryPick"; data: { sha: string; branch?: string } }
  | { command: "cherryPickAbort" }
  | { command: "revert"; data: { sha: string; branch?: string } }
  | { command: "revertAbort" }
  | { command: "openScmView" }
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
  | { command: "cherryPickResult"; data: CherryPickResult }
  | { command: "cherryPickAborted"; data: CherryPickAbortResult }
  | { command: "revertResult"; data: CherryPickResult }
  | { command: "revertAborted"; data: CherryPickAbortResult }
  | { command: "settingsUpdated"; data: Settings };
