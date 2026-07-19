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

export type ThemeMode = "dark" | "light";
export type Language = "ru" | "en";

export interface Settings {
  releasePrefix: string;
  theme: ThemeMode;
  language: Language;
}

/** Messages sent from the webview to the extension host. */
export type OutboundMessage =
  | { command: "getBranches" }
  | { command: "refreshBranches" }
  | { command: "getSettings" }
  | { command: "updateSettings"; data: Partial<Settings> }
  | { command: "noopCreateRelease" };

/** Messages sent from the extension host to the webview. */
export type InboundMessage =
  | { command: "branchesUpdated"; data: ListBranchesResult }
  | { command: "settingsUpdated"; data: Settings };
