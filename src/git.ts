import simpleGit from "simple-git";
import * as vscode from "vscode";

/** Information about a single release branch. */
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
  | { ok: false; reason: "no-folder" | "not-a-repo" | "git-error"; message: string };

/**
 * Resolve the working directory that git commands should run in.
 * Returns the first workspace folder, or null if no folder is open.
 */
export function getWorkspaceCwd(): string | null {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return null;
  }
  return folders[0].uri.fsPath;
}

/**
 * List all git branches whose name starts with `prefix`, sorted by last
 * commit date (newest first). Each branch is enriched with metadata from
 * its most recent commit.
 */
export async function listReleaseBranches(
  cwd: string,
  prefix: string,
): Promise<ListBranchesResult> {
  const git = simpleGit({ baseDir: cwd });

  // Verify we are inside a git working tree.
  let isRepo = false;
  try {
    isRepo = await git.checkIsRepo();
  } catch {
    // ignore — treat as not-a-repo
  }
  if (!isRepo) {
    return {
      ok: false,
      reason: "not-a-repo",
      message: "The open folder is not a Git repository.",
    };
  }

  // `git.branch --list 'release/*' --sort=-committerdate`
  const safePrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
  let summary;
  try {
    summary = await git.branch(["--list", `${safePrefix}*`, "--sort=-committerdate"]);
  } catch (err) {
    return {
      ok: false,
      reason: "git-error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const names = Object.keys(summary.branches);
  if (names.length === 0) {
    return { ok: true, branches: [] };
  }

  const branches: BranchInfo[] = [];
  for (const name of names) {
    const meta = summary.branches[name];
    try {
      const log = await git.log({ from: meta.commit, to: "HEAD", maxCount: 1 });
      const latest = log.latest;
      branches.push({
        name,
        lastCommitDate: latest?.date ?? new Date().toISOString(),
        author: latest?.author_name ?? meta.commit,
        sha: meta.commit,
      });
    } catch {
      // Fall back to whatever we already know from the branch summary.
      branches.push({
        name,
        lastCommitDate: new Date().toISOString(),
        author: meta.commit,
        sha: meta.commit,
      });
    }
  }

  // `git branch --sort` already orders them, but enforce a stable order in
  // case the underlying sort is unstable across platforms.
  branches.sort(
    (a, b) =>
      new Date(b.lastCommitDate).getTime() - new Date(a.lastCommitDate).getTime(),
  );

  return { ok: true, branches };
}
