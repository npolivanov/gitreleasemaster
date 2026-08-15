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

    let candidateShas: string[] = [];

    // 1. Строгий поиск частичного SHA только в истории upstreamBranch
    try {
      // Получаем список ВСЕХ коммитов, являющихся предками upstreamBranch
      const listOutput = await git.raw(["rev-list", upstreamBranch]);
      const allShas = listOutput.trim().split("\n").filter(Boolean);

      // Ищем совпадения по префиксу (как это делает rev-parse, но только среди наших коммитов)
      const matches = allShas.filter((sha) => sha.startsWith(query));

      if (matches.length > 0) {
        candidateShas = matches;
      }
    } catch {
      // Ветка не найдена или другая ошибка
    }
    // 2. Если не SHA, ищем как подстроку в сообщениях коммитов
    if (candidateShas.length === 0) {
      try {
        const log = await git.log([
          upstreamBranch,
          `--grep=${query}`,
          "-F",
          "-i",
        ]);

        if (log.all.length > 0) {
          candidateShas = log.all.map((commit) => commit.hash);
        }
      } catch (error) {
        console.log("ERROR >>>>", error);
        // ignore — ниже попадём в notFound
      }
    }

    // 3. Проверяем найденные кандидаты на вхождение в upstreamBranch
    let foundInUpstream = false;

    for (const hash of candidateShas) {
      try {
        // Проверяем, является ли коммит предком upstreamBranch
        await git.raw(["merge-base", "--is-ancestor", hash, upstreamBranch]);

        // Получаем метаданные
        const out = await git.raw([
          "log",
          "-1",
          hash,
          "--format=%H%x1f%an%x1f%aI%x1f%s",
        ]);
        const [sha, author, date, message] = out.trim().split("\x1f");

        if (sha) {
          resolved[sha] = {
            shortSha: sha.slice(0, 7),
            message: message ?? "",
            author: author ?? "",
            date: date ?? "",
          };
          foundInUpstream = true;
        }
      } catch {
        // Коммит не является предком upstreamBranch или произошла ошибка парсинга.
        // Игнорируем, продолжаем цикл (возможно, подойдут следующие хэши из grep).
      }
    }

    // 4. Если ни один кандидат не подошел (или их не было вообще) — в notFound
    if (!foundInUpstream) {
      notFound.push(query);
    }
  }

  return { ok: true, resolved, notFound };
}

/** Статус одного cherry-pick. */
export type CherryPickStatus =
  | "applied"
  | "skipped"
  | "conflict"
  | "error";

/** Почему коммит был пропущен (status === "skipped"). */
export type CherryPickSkipReason = "in-branch" | "empty-patch";

/** Результат cherry-pick одного коммита. `sha` — эхо запроса. */
export interface CherryPickResult {
  sha: string;
  status: CherryPickStatus;
  /** Конфликтующие файлы (для status === "conflict"). */
  files: string[];
  /** Текст ошибки (для status === "error"). */
  message: string;
  /** Ветка, на которой выполнен cherry-pick (для отображения в UI). */
  branch: string;
  /** Причина пропуска (для status === "skipped"). */
  skippedReason?: CherryPickSkipReason;
}

/** Результат `git cherry-pick --continue` после ручного резолва конфликта. */
export interface CherryPickContinueResult {
  status: "applied" | "conflict" | "error";
  files: string[];
  message: string;
}

/** Результат `git cherry-pick --abort`. */
export interface CherryPickAbortResult {
  ok: boolean;
  message: string;
}

/** Собрать список конфликтующих файлов из статуса рабочего дерева. */
async function getConflictedFiles(
  git: ReturnType<typeof simpleGit>,
): Promise<string[]> {
  try {
    const status = await git.status();
    if (status.conflicted.length > 0) {
      return status.conflicted;
    }
  } catch {
    // ignore — пробуем raw-fallback ниже
  }
  // Fallback: unmerged-файлы напрямую из git (если парсер simple-git ничего не нашёл).
  try {
    const out = await git.raw(["diff", "--name-only", "--diff-filter=U"]);
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Существует ли незавершённый cherry-pick (файл CHERRY_PICK_HEAD).
 * Признак того, что sequencer активен и ждёт резолва/continue.
 */
async function hasCherryPickHead(
  git: ReturnType<typeof simpleGit>,
): Promise<boolean> {
  try {
    await git.raw(["rev-parse", "-q", "--verify", "CHERRY_PICK_HEAD"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Применить один коммит через `git cherry-pick` на ветку `expectedBranch`.
 *
 * Если передан `expectedBranch` и текущая ветка отличается — хост сначала
 * переключается на неё (`git checkout`). Это гарантирует, что коммиты попадают
 * именно в релизную ветку, даже если пользователь переключал ветки между
 * шагами wizard'а.
 *
 * Порядок проверок:
 *   0. Убедиться, что активна `expectedBranch` (иначе — checkout).
 *   1. Коммит уже в истории HEAD (`merge-base --is-ancestor`) → "skipped"
 *      с причиной "in-branch".
 *   2. `cherry-pick` успешен → "applied".
 *   3. Ошибка: конфликт (unmerged-файлы, CHERRY_PICK_HEAD или «already in
 *      progress») → "conflict" (+ файлы для UI). Патч пуст (изменения уже
 *      применены) → `--skip` и "skipped" с причиной "empty-patch".
 *      Иначе → "error".
 */
export async function cherryPickCommit(
  cwd: string,
  sha: string,
  expectedBranch?: string,
): Promise<CherryPickResult> {
  const git = simpleGit({ baseDir: cwd });

  let isRepo = false;
  try {
    isRepo = await git.checkIsRepo();
  } catch {
    // ignore — treat as not-a-repo
  }
  if (!isRepo) {
    return {
      sha,
      status: "error",
      files: [],
      message: "The open folder is not a Git repository.",
      branch: "",
    };
  }

  // 0. Гарантировать целевую ветку: если пользователь переключил ветку между
  //    шагами — возвращаемся на релизную перед применением.
  let currentBranch = "";
  try {
    currentBranch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
  } catch {
    // не критично — продолжаем с пустым именем
  }

  if (expectedBranch && expectedBranch !== currentBranch) {
    try {
      await git.checkout(expectedBranch);
      currentBranch = expectedBranch;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        sha,
        status: "error",
        files: [],
        message: `Не удалось переключиться на ветку «${expectedBranch}»: ${message}`,
        branch: currentBranch,
      };
    }
  }

  // 1. Коммит уже входит в историю текущей ветки — пропускаем.
  try {
    await git.raw(["merge-base", "--is-ancestor", sha, "HEAD"]);
    return {
      sha,
      status: "skipped",
      files: [],
      message: "",
      branch: currentBranch,
      skippedReason: "in-branch",
    };
  } catch {
    // не предок HEAD — это нормально, применяем cherry-pick
  }

  // 2. Сам cherry-pick.
  //    ВАЖНО: без `-c core.editor=...` — в git ≥ 2.48 это фатальная ошибка
  //    («Configuring core.editor is not permitted without enabling
  //    allowUnsafeEditor»), которая убивает команду ещё до её выполнения.
  //    Обычному cherry-pick редактор не нужен: сообщение берётся из коммита.
  try {
    await git.raw(["cherry-pick", sha]);
    return {
      sha,
      status: "applied",
      files: [],
      message: "",
      branch: currentBranch,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // 3a. Конфликт: unmerged-файлы в рабочем дереве, активный sequencer
    //     (CHERRY_PICK_HEAD) или cherry-pick поверх незавершённого.
    const alreadyInProgress = /already in progress/i.test(message);
    const files = await getConflictedFiles(git);
    const sequencerActive = await hasCherryPickHead(git);
    if (files.length > 0 || sequencerActive || alreadyInProgress) {
      return {
        sha,
        status: "conflict",
        files,
        message: "",
        branch: currentBranch,
      };
    }

    // 3b. Пустой патч — изменения уже применены другим коммитом.
    //     Git оставляет sequencer в незавершённом состоянии — чистим через --skip.
    if (/nothing to commit|now empty|allow-empty/i.test(message)) {
      try {
        await git.raw(["cherry-pick", "--skip"]);
      } catch {
        // ignore — даже если --skip не нужен, считаем пропуск состоявшимся
      }
      return {
        sha,
        status: "skipped",
        files: [],
        message: "",
        branch: currentBranch,
        skippedReason: "empty-patch",
      };
    }

    // 3c. Прочая ошибка git.
    return { sha, status: "error", files: [], message, branch: currentBranch };
  }
}

/**
 * Завершить cherry-pick после ручного разрешения конфликта пользователем
 * (`git cherry-pick --continue`). Если конфликты ещё не зарезолвлены —
 * вернёт "conflict" снова (пользователь может продолжать пытаться).
 *
 * Редактор не нужен: cherry-pick без `--edit` использует сообщение
 * оригинального коммита как есть (подтверждено синтетическим тестом),
 * а `-c core.editor=...` в git ≥ 2.48 фатально запрещён — не используем его.
 */
export async function cherryPickContinue(
  cwd: string,
): Promise<CherryPickContinueResult> {
  const git = simpleGit({ baseDir: cwd });

  try {
    await git.raw(["cherry-pick", "--continue"]);
    return { status: "applied", files: [], message: "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    const files = await getConflictedFiles(git);
    if (files.length > 0) {
      return { status: "conflict", files, message: "" };
    }
    // Sequencer ещё активен (не всё зарезолвлено/застажено) — остаёмся в конфликте.
    if (await hasCherryPickHead(git)) {
      return { status: "conflict", files: [], message: "" };
    }

    return { status: "error", files: [], message };
  }
}

/** Отменить незавершённый cherry-pick (`git cherry-pick --abort`). */
export async function cherryPickAbort(
  cwd: string,
): Promise<CherryPickAbortResult> {
  const git = simpleGit({ baseDir: cwd });

  try {
    await git.raw(["cherry-pick", "--abort"]);
    return { ok: true, message: "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}
