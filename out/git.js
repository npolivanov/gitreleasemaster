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
exports.cherryPickCommit = cherryPickCommit;
exports.cherryPickContinue = cherryPickContinue;
exports.cherryPickAbort = cherryPickAbort;
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
 * `upstreamBranch`** через `git merge-base --is-ancestor`. Если коммит не
 * является предком выбранной ветки — он считается не найденным (попадает в
 * `notFound`). Так пользователь не добавит коммит из чужой ветки.
 *
 * Не найденные query возвращаются в `notFound`, чтобы UI их подсветил.
 */
async function resolveCommits(cwd, upstreamBranch, queries) {
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
        }
        catch {
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
            }
            catch (error) {
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
            }
            catch {
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
 */
async function hasCherryPickHead(git) {
    try {
        await git.raw(["rev-parse", "-q", "--verify", "CHERRY_PICK_HEAD"]);
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
    }
    catch {
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
    }
    catch (err) {
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
async function cherryPickContinue(cwd) {
    const git = (0, simple_git_1.default)({ baseDir: cwd });
    try {
        await git.raw(["cherry-pick", "--continue"]);
        return { status: "applied", files: [], message: "" };
    }
    catch (err) {
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
//# sourceMappingURL=git.js.map