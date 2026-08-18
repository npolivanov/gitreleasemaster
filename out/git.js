"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkspaceCwd = getWorkspaceCwd;
exports.listReleaseBranches = listReleaseBranches;
exports.listAllBranches = listAllBranches;
exports.createReleaseBranch = createReleaseBranch;
exports.checkoutExistingBranch = checkoutExistingBranch;
exports.resolveCommits = resolveCommits;
exports.listBranchLog = listBranchLog;
exports.cherryPickCommit = cherryPickCommit;
exports.cherryPickAbort = cherryPickAbort;
exports.revertAbort = revertAbort;
exports.revertCommit = revertCommit;
const simple_git_1 = __importDefault(require("simple-git"));
const vscode = __importStar(require("vscode"));
/**
 * Resolve the working directory that git commands should run in.
 * Returns the first workspace folder, or null if no folder is open.
 */
function getWorkspaceCwd() {
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
async function listReleaseBranches(cwd, prefix) {
    const git = (0, simple_git_1.default)({ baseDir: cwd });
    // Verify we are inside a git working tree.
    let isRepo = false;
    try {
        isRepo = await git.checkIsRepo();
    }
    catch {
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
    }
    catch (err) {
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
    const branches = [];
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
        }
        catch {
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
    branches.sort((a, b) => new Date(b.lastCommitDate).getTime() -
        new Date(a.lastCommitDate).getTime());
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
async function listAllBranches(cwd) {
    const git = (0, simple_git_1.default)({ baseDir: cwd });
    let isRepo = false;
    try {
        isRepo = await git.checkIsRepo();
    }
    catch {
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
    }
    catch (err) {
        return {
            ok: false,
            query: "",
            reason: "git-error",
            message: err instanceof Error ? err.message : String(err),
        };
    }
    const branches = Object.entries(summary.branches).map(([name, meta]) => ({ name, sha: meta.commit }));
    return { ok: true, query: "", branches };
}
/**
 * Создать новую ветку `fullBranchName` от `fromBranch` и переключиться на неё.
 *
 * Эквивалент `git checkout -b fullBranchName fromBranch`: создаёт ветку и
 * делает её активной одним вызовом. Если ветка уже существует — git падает с
 * сообщением «already exists», которое мы нормализуем в `reason: "already-exists"`.
 */
async function createReleaseBranch(cwd, fromBranch, fullBranchName) {
    const git = (0, simple_git_1.default)({ baseDir: cwd });
    let isRepo = false;
    try {
        isRepo = await git.checkIsRepo();
    }
    catch {
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const reason = /already exists/i.test(message)
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
async function checkoutExistingBranch(cwd, branchName) {
    const git = (0, simple_git_1.default)({ baseDir: cwd });
    let isRepo = false;
    try {
        isRepo = await git.checkIsRepo();
    }
    catch {
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
    }
    catch (err) {
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
async function resolveCommits(cwd, branch, queries) {
    const git = (0, simple_git_1.default)({ baseDir: cwd });
    let isRepo = false;
    try {
        isRepo = await git.checkIsRepo();
    }
    catch {
        // ignore — treat as not-a-repo
    }
    if (!isRepo) {
        return {
            ok: false,
            reason: "not-a-repo",
            message: "The open folder is not a Git repository.",
        };
    }
    const resolved = {};
    const notFound = [];
    for (const raw of queries) {
        const query = raw.trim();
        if (query === "") {
            continue;
        }
        let candidateShas = [];
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
        }
        catch {
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
            }
            catch (error) {
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
            }
            catch {
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
/**
 * Страница лога ветки: `git log <branch> --skip=N --max-count=L+1`.
 *
 * Новые коммиты первыми (стандартный порядок git log). Пустая `branch`
 * означает текущую HEAD.
 */
async function listBranchLog(cwd, branch, skip, limit) {
    const git = (0, simple_git_1.default)({ baseDir: cwd });
    let isRepo = false;
    try {
        isRepo = await git.checkIsRepo();
    }
    catch {
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
        const commits = lines.slice(0, limit).map((line) => {
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, message };
    }
}
/** Собрать список конфликтующих файлов из статуса рабочего дерева. */
async function getConflictedFiles(git) {
    try {
        const status = await git.status();
        if (status.conflicted.length > 0) {
            return status.conflicted;
        }
    }
    catch {
        // ignore — пробуем raw-fallback ниже
    }
    // Fallback: unmerged-файлы напрямую из git (если парсер simple-git ничего не нашёл).
    try {
        const out = await git.raw(["diff", "--name-only", "--diff-filter=U"]);
        return out.trim().split("\n").filter(Boolean);
    }
    catch {
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
async function hasCherryPickHead(git) {
    try {
        await git.raw(["rev-parse", "CHERRY_PICK_HEAD"]);
        return true;
    }
    catch {
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
async function cherryPickCommit(cwd, sha, expectedBranch) {
    const git = (0, simple_git_1.default)({ baseDir: cwd });
    let isRepo = false;
    try {
        isRepo = await git.checkIsRepo();
    }
    catch {
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
    }
    catch {
        // не критично — продолжаем с пустым именем
    }
    if (expectedBranch && expectedBranch !== currentBranch) {
        try {
            await git.checkout(expectedBranch);
            currentBranch = expectedBranch;
        }
        catch (err) {
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
    let pendingSha = null;
    try {
        pendingSha = (await git.raw(["rev-parse", "CHERRY_PICK_HEAD"])).trim();
    }
    catch {
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
        }
        catch (err) {
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
    }
    catch (err) {
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
            }
            catch {
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
async function cherryPickAbort(cwd) {
    const git = (0, simple_git_1.default)({ baseDir: cwd });
    try {
        await git.raw(["cherry-pick", "--abort"]);
        return { ok: true, message: "" };
    }
    catch (err) {
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
async function revertAbort(cwd) {
    const git = (0, simple_git_1.default)({ baseDir: cwd });
    try {
        await git.raw(["revert", "--abort"]);
        return { ok: true, message: "" };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, message };
    }
}
/** Существует ли незавершённый revert (файл REVERT_HEAD). */
async function hasRevertHead(git) {
    try {
        await git.raw(["rev-parse", "REVERT_HEAD"]);
        return true;
    }
    catch {
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
async function revertCommit(cwd, sha, expectedBranch) {
    const git = (0, simple_git_1.default)({ baseDir: cwd });
    let isRepo = false;
    try {
        isRepo = await git.checkIsRepo();
    }
    catch {
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
    }
    catch {
        // не критично — продолжаем с пустым именем
    }
    if (expectedBranch && expectedBranch !== currentBranch) {
        try {
            await git.checkout(expectedBranch);
            currentBranch = expectedBranch;
        }
        catch (err) {
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
    let pendingSha = null;
    try {
        pendingSha = (await git.raw(["rev-parse", "REVERT_HEAD"])).trim();
    }
    catch {
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
        }
        catch (err) {
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
    }
    catch (err) {
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
            }
            catch {
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
//# sourceMappingURL=git.js.map