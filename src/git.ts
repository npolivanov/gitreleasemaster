import simpleGit, { ListLogLine } from "simple-git";
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
  | {
      ok: false;
      reason: "no-folder" | "not-a-repo" | "git-error";
      message: string;
    };

/** Минимальная инфа о ветке для поиска — без дорогого git.log. */
export type BranchOption = Pick<BranchInfo, "name" | "sha">;

/**
 * Результат поиска веток по подстроке.
 *
 * `query` возвращается эхом, чтобы webview мог отсеять устаревшие ответы
 * (когда пользователь успел напечатать что-то новое, пока хост отвечал).
 */
export type BranchSearchResult =
  | { ok: true; query: string; branches: BranchOption[] }
  | {
      ok: false;
      query: string;
      reason: "no-folder" | "not-a-repo" | "git-error";
      message: string;
    };

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
    summary = await git.branch([
      "--list",
      `${safePrefix}*`,
      "--sort=-committerdate",
    ]);
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
      new Date(b.lastCommitDate).getTime() -
      new Date(a.lastCommitDate).getTime(),
  );

  return { ok: true, branches };
}

/**
 * Список ВСЕХ веток репозитория (без префиксного фильтра и без поиска по подстроке).
 *
 * Загружается один раз при открытии SelectBranch и кэшируется на стороне
 * webview; дальнейший поиск/фильтрация идут клиентски — мгновенно, без
 * round-trip через postMessage при каждом нажатии клавиши.
 *
 * Поля — только `name` + `sha` (из summary.branches), без отдельных `git.log`
 * вызовов на каждую ветку.
 */
export async function listAllBranches(
  cwd: string,
): Promise<BranchSearchResult> {
  const git = simpleGit({ baseDir: cwd });

  let isRepo = false;
  try {
    isRepo = await git.checkIsRepo();
  } catch {
    // ignore — treat as not-a-repo
  }
  if (!isRepo) {
    return {
      ok: false,
      query: "",
      reason: "not-a-repo",
      message: "The open folder is not a Git repository.",
    };
  }

  // `git branch --sort=-committerdate` — один вызов, без `--list`.
  let summary;
  try {
    summary = await git.branch(["--sort=-committerdate"]);
  } catch (err) {
    return {
      ok: false,
      query: "",
      reason: "git-error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const branches: BranchOption[] = Object.entries(summary.branches).map(
    ([name, meta]) => ({ name, sha: meta.commit }),
  );

  return { ok: true, query: "", branches };
}

/** Результат создания релизной ветки. */
export type CreateBranchResult =
  | { ok: true }
  | {
      ok: false;
      reason: "not-a-repo" | "git-error" | "already-exists";
      message: string;
    };

/** Реальный коммит, разрешённый из введённого пользователем query (SHA/сообщение). */
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

export type ResolvedCommit = Record<string, Partial<ResolvedCommitItem>>;
/**
 * Результат разрешения списка коммитов.
 *
 * `notFound` содержит исходные query, которые не удалось сопоставить коммиту —
 * чтобы UI мог подсветить их пользователю.
 */
export type ResolveCommitsResult =
  | { ok: true; resolved: ResolvedCommit; notFound: string[] }
  | {
      ok: false;
      reason: "no-folder" | "not-a-repo" | "git-error";
      message: string;
    };

/**
 * Создать новую ветку `fullBranchName` от `fromBranch` и переключиться на неё.
 *
 * Эквивалент `git checkout -b fullBranchName fromBranch`: создаёт ветку и
 * делает её активной одним вызовом. Если ветка уже существует — git падает с
 * сообщением «already exists», которое мы нормализуем в `reason: "already-exists"`.
 */
export async function createReleaseBranch(
  cwd: string,
  fromBranch: string,
  fullBranchName: string,
): Promise<CreateBranchResult> {
  const git = simpleGit({ baseDir: cwd });

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

  try {
    // `git checkout -b fullBranchName fromBranch` — создать и переключиться.
    await git.checkoutBranch(fullBranchName, fromBranch);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const reason: "already-exists" | "git-error" = /already exists/i.test(
      message,
    )
      ? "already-exists"
      : "git-error";
    return { ok: false, reason, message };
  }
}

/**
 * Переключиться на существующую локальную ветку `branchName`.
 *
 * Эквивалент `git checkout branchName` — без создания новой ветки.
 * Используется, когда пользователь выбрал «Использовать ветку-источник как
 * основную» и создавать релизную ветку не нужно.
 */
export async function checkoutExistingBranch(
  cwd: string,
  branchName: string,
): Promise<CreateBranchResult> {
  const git = simpleGit({ baseDir: cwd });

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

  try {
    await git.checkout(branchName);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "git-error", message };
  }
}

/**
 * Разрешить каждый query из `queries` в реальный коммит репозитория.
 *
 * `query` может быть:
 *   - полным/частичным SHA → резолвится через `git rev-parse`;
 *   - иначе подстрокой сообщения → ищется через `git log --grep -i`
 *     (по всей истории репозитория, case-insensitive).
 *
 * После разрешения найденный коммит **проверяется на вхождение в
 * `upstreamBranch`** через `git merge-base --is-ancestor`. Если коммит не
 * является предком выбранной ветки — он считается не найденным (попадает в
 * `notFound`). Так пользователь не добавит коммит из чужой ветки.
 *
 * Не найденные query возвращаются в `notFound`, чтобы UI их подсветил.
 */
export async function resolveCommits(
  cwd: string,
  upstreamBranch: string,
  queries: string[],
): Promise<ResolveCommitsResult> {
  console.log("!!!! WORKING !!!!!");

  const git = simpleGit({ baseDir: cwd });

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

  const resolved: ResolvedCommit = {};
  const notFound: string[] = [];

  for (const raw of queries) {
    const query = raw.trim();
    if (query === "") {
      continue;
    }

    let candidateSha: Array<string> | null = null;

    // Ищем сначала по хэшу
    try {
      await git.raw(["merge-base", "--is-ancestor", query, upstreamBranch]);
      candidateSha = [query];
    } catch {
      ///
    }

    if (!candidateSha) {
      try {
        const log = await git.log([
          upstreamBranch,
          `--grep=${query}`,
          "-F",
          "-i",
        ]);
        console.log("log.all >>>>", log.all);

        if (log.all.length) {
          candidateSha = log.all.map((commit) => commit.hash);
        }
      } catch (error) {
        console.log("ERROR >>>>", error);
        // ignore — ниже попадём в notFound
      }
    }

    for (let hash of candidateSha || []) {
      // Метаданные через raw git log (simple-git'овский git.log({ hash }) падает
      // с "unknown revision", формируя невалидный аргумент hash=...).
      try {
        await git.raw(["merge-base", "--is-ancestor", hash, upstreamBranch]);

        const out = await git.raw([
          "log",
          "-1",
          hash,
          "--format=%H%x1f%an%x1f%aI%x1f%s",
        ]);
        const [sha, author, date, message] = out.trim().split("\x1f");
        if (!sha) {
          notFound.push(query);
          continue;
        }
        resolved[sha] = {
          shortSha: sha.slice(0, 7),
          message: message ?? "",
          author: author ?? "",
          date: date ?? "",
        };
      } catch {
        notFound.push(query);
      }
    }
  }

  return { ok: true, resolved, notFound };
}
