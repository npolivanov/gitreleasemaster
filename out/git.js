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
    console.log("!!!! WORKING !!!!!");
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
        let candidateSha = null;
        // Ищем сначала по хэшу
        try {
            await git.raw(["merge-base", "--is-ancestor", query, upstreamBranch]);
            candidateSha = [query];
        }
        catch {
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
            }
            catch (error) {
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
            }
            catch {
                notFound.push(query);
            }
        }
    }
    return { ok: true, resolved, notFound };
}
//# sourceMappingURL=git.js.map