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
 * `branch`** через `git merge-base --is-ancestor`. Если коммит не
 * является предком выбранной ветки — он считается не найденным (попадает в
 * `notFound`). Так пользователь не добавит коммит из чужой ветки.
 *
 * Не найденные query возвращаются в `notFound`, чтобы UI их подсветил.
 */
export async function resolveCommits(
  cwd: string,
  branch: string,
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

    // 1. Строгий поиск частичного SHA только в истории branch
    try {
      // Получаем список ВСЕХ коммитов, являющихся предками branch
      const listOutput = await git.raw(["rev-list", branch]);
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
          branch,
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

    // 3. Проверяем найденные кандидаты на вхождение в branch
    let foundInUpstream = false;

    for (const hash of candidateShas) {
      try {
        // Проверяем, является ли коммит предком branch
        await git.raw(["merge-base", "--is-ancestor", hash, branch]);

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
        // Коммит не является предком branch или произошла ошибка парсинга.
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

/** Результат `git cherry-pick --abort`. */
export interface CherryPickAbortResult {
  ok: boolean;
  message: string;
}

/** Одна запись лога ветки (для popup со списком коммитов). */
export interface BranchLogEntry {
  /** Полный SHA (ключ записи). */
  sha: string;
  /** Короткий SHA. */
  shortSha: string;
  /** Первая строка сообщения. */
  message: string;
  /** Автор. */
  author: string;
  /** ISO-дата. */
  date: string;
}

/**
 * Страница лога ветки. `hasMore` = true, если в ветке есть коммиты глубже
 * (запрошено limit+1, лишний отброшен) — UI докрутит следующую страницу.
 */
export type BranchLogResult =
  | { ok: true; commits: BranchLogEntry[]; hasMore: boolean }
  | { ok: false; message: string };

/**
 * Страница лога ветки: `git log <branch> --skip=N --max-count=L+1`.
 *
 * Новые коммиты первыми (стандартный порядок git log). Пустая `branch`
 * означает текущую HEAD.
 */
export async function listBranchLog(
  cwd: string,
  branch: string,
  skip: number,
  limit: number,
): Promise<BranchLogResult> {
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
      message: "The open folder is not a Git repository.",
    };
  }

  const rev = branch.trim() === "" ? "HEAD" : branch.trim();
  try {
    // +1 к limit — чтобы понять, есть ли следующая страница.
    const out = await git.raw([
      "log",
      rev,
      `--skip=${Math.max(0, skip)}`,
      `--max-count=${limit + 1}`,
      "--format=%H%x1f%h%x1f%an%x1f%aI%x1f%s",
    ]);

    const lines = out.trim().split("\n").filter(Boolean);
    const hasMore = lines.length > limit;

    const commits: BranchLogEntry[] = lines.slice(0, limit).map((line) => {
      const [sha, shortSha, author, date, message] = line.split("\x1f");
      return {
        sha,
        shortSha,
        author: author ?? "",
        date: date ?? "",
        message: message ?? "",
      };
    });

    return { ok: true, commits, hasMore };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
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
 *
 * Обычный `rev-parse CHERRY_PICK_HEAD` без `-q --verify`: бросает исключение,
 * когда файла нет (проверено эмпирически), и возвращает sha, когда есть.
 */
async function hasCherryPickHead(
  git: ReturnType<typeof simpleGit>,
): Promise<boolean> {
  try {
    await git.raw(["rev-parse", "CHERRY_PICK_HEAD"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Применить один коммит через `git cherry-pick` на ветку `expectedBranch`.
 *
 * Если передан `expectedBranch` и текущая ветка отличается — хост сначала
 * переключается на неё (`git checkout`).
 *
 * ПРОСТАЯ логика — без пре-чеков, которые могут ложно пометить коммит
 * пропущенным:
 *   1. Если остался незавершённый cherry-pick от прошлого конфликта —
 *      доводим его `cherry-pick --continue` (пользователь уже зарезолвил).
 *      Если доведённый коммит — это наш `sha`, возвращаем "applied".
 *   2. `git cherry-pick <sha>`:
 *      успех → "applied";
 *      конфликт (unmerged-файлы / CHERRY_PICK_HEAD / already in progress) →
 *        "conflict" (+ файлы) — очередь останавливается, пользователь
 *        резолвит в VS Code и жмёт «Заново»;
 *      пустой патч (изменения уже применены) → "skipped" с причиной
 *        "empty-patch" — единственный честный случай пропуска;
 *      иначе → "error".
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

  // 1. Незавершённый cherry-pick от прошлого конфликта: пользователь зарезолвил
  //    и нажал «Заново» — доводим pending-коммит сами. Если это был наш sha,
  //    он применён — возвращаем "applied" без повторного pick.
  let pendingSha: string | null = null;
  try {
    pendingSha = (await git.raw(["rev-parse", "CHERRY_PICK_HEAD"])).trim();
  } catch {
    pendingSha = null; // sequencer не активен
  }

  if (pendingSha) {
    const unresolved = await getConflictedFiles(git);
    if (unresolved.length > 0) {
      // Пользователь ещё не зарезолвил прошлый конфликт.
      return {
        sha: pendingSha,
        status: "conflict",
        files: unresolved,
        message: "",
        branch: currentBranch,
      };
    }

    try {
      await git.raw(["cherry-pick", "--continue"]);
      if (pendingSha === sha) {
        return {
          sha,
          status: "applied",
          files: [],
          message: "",
          branch: currentBranch,
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const files = await getConflictedFiles(git);
      if (files.length > 0) {
        return {
          sha: pendingSha,
          status: "conflict",
          files,
          message: "",
          branch: currentBranch,
        };
      }
      return { sha, status: "error", files: [], message, branch: currentBranch };
    }
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

    // 2a. Реальный конфликт: unmerged-файлы в рабочем дереве.
    //     Проверяется ПЕРВЫМ — при пустом pick файлы тоже пусты.
    const files = await getConflictedFiles(git);
    if (files.length > 0) {
      return {
        sha,
        status: "conflict",
        files,
        message: "",
        branch: currentBranch,
      };
    }

    // 2b. Пустой патч — изменения уже применены (сообщение git подтверждает).
    //     ВАЖНО: до sequencer-детекта — пустой pick тоже активирует sequencer.
    //     Sequencer при этом остаётся — чистим через --skip.
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

    // 2c. Незавершённый sequencer от другого конфликта или «already in
    //     progress» — тоже конфликтное состояние (требует резолва/«Заново»).
    const alreadyInProgress = /already in progress/i.test(message);
    if (alreadyInProgress || (await hasCherryPickHead(git))) {
      return {
        sha,
        status: "conflict",
        files: [],
        message: "",
        branch: currentBranch,
      };
    }

    // 2d. Прочая ошибка git.
    return { sha, status: "error", files: [], message, branch: currentBranch };
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

/**
 * Отменить незавершённый revert (`git revert --abort`).
 *
 * Отдельная команда для режима удаления: sequencer у cherry-pick и revert
 * общий, но режимно-корректная команда надёжнее.
 */
export async function revertAbort(
  cwd: string,
): Promise<CherryPickAbortResult> {
  const git = simpleGit({ baseDir: cwd });

  try {
    await git.raw(["revert", "--abort"]);
    return { ok: true, message: "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

/** Существует ли незавершённый revert (файл REVERT_HEAD). */
async function hasRevertHead(
  git: ReturnType<typeof simpleGit>,
): Promise<boolean> {
  try {
    await git.raw(["rev-parse", "REVERT_HEAD"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Удалить один коммит из ветки `expectedBranch` через `git revert --no-edit`.
 *
 * Зеркало `cherryPickCommit` для режима удаления, отличия:
 *   - команда `git revert --no-edit <sha>` (`--no-edit` — валидный флаг,
 *     отключающий редактор сообщения; конфигурация core.editor в git ≥ 2.48
 *     запрещена, поэтому только флаг);
 *   - pending-детект через `REVERT_HEAD`, доводка — `git revert --continue`;
 *   - пустой патч (изменения уже отсутствуют) — `git revert --skip`.
 *
 * Результат — тот же контракт `CherryPickResult` (applied/skipped/conflict/
 * error + файлы + ветка), чтобы webview переиспользовал стейт-машину.
 */
export async function revertCommit(
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

  // 0. Гарантировать целевую (релизную) ветку.
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

  // 1. Незавершённый revert от прошлого конфликта: пользователь зарезолвил
  //    и нажал «Заново» — доводим pending-коммит сами.
  let pendingSha: string | null = null;
  try {
    pendingSha = (await git.raw(["rev-parse", "REVERT_HEAD"])).trim();
  } catch {
    pendingSha = null; // sequencer не активен
  }

  if (pendingSha) {
    const unresolved = await getConflictedFiles(git);
    if (unresolved.length > 0) {
      return {
        sha: pendingSha,
        status: "conflict",
        files: unresolved,
        message: "",
        branch: currentBranch,
      };
    }

    try {
      await git.raw(["revert", "--continue"]);
      if (pendingSha === sha) {
        return {
          sha,
          status: "applied",
          files: [],
          message: "",
          branch: currentBranch,
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const files = await getConflictedFiles(git);
      if (files.length > 0) {
        return {
          sha: pendingSha,
          status: "conflict",
          files,
          message: "",
          branch: currentBranch,
        };
      }
      return { sha, status: "error", files: [], message, branch: currentBranch };
    }
  }

  // 2. Сам revert.
  try {
    await git.raw(["revert", "--no-edit", sha]);
    return {
      sha,
      status: "applied",
      files: [],
      message: "",
      branch: currentBranch,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // 2a. Реальный конфликт: unmerged-файлы в рабочем дереве.
    const files = await getConflictedFiles(git);
    if (files.length > 0) {
      return {
        sha,
        status: "conflict",
        files,
        message: "",
        branch: currentBranch,
      };
    }

    // 2b. Пустой патч — изменения уже отсутствуют (сообщение git подтверждает).
    //     Проверяется ДО sequencer-детекта — пустой revert тоже активирует
    //     sequencer.
    if (/nothing to commit|now empty|allow-empty/i.test(message)) {
      try {
        await git.raw(["revert", "--skip"]);
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

    // 2c. Незавершённый sequencer или «already in progress».
    const alreadyInProgress = /already in progress/i.test(message);
    if (alreadyInProgress || (await hasRevertHead(git))) {
      return {
        sha,
        status: "conflict",
        files: [],
        message: "",
        branch: currentBranch,
      };
    }

    // 2d. Прочая ошибка git.
    return { sha, status: "error", files: [], message, branch: currentBranch };
  }
}
