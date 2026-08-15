"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeListBranches = safeListBranches;
exports.safeListAllBranches = safeListAllBranches;
exports.safeCreateReleaseBranch = safeCreateReleaseBranch;
exports.safeUseSourceBranch = safeUseSourceBranch;
exports.safeResolveCommits = safeResolveCommits;
exports.safeCherryPick = safeCherryPick;
exports.safeCherryPickContinue = safeCherryPickContinue;
exports.safeCherryPickAbort = safeCherryPickAbort;
const git_1 = require("../git");
const settings_1 = require("./settings");
/**
 * Получить список релизных веток с дружелюбной обработкой ошибок.
 *
 * Определяет рабочую папку, берёт актуальный `releasePrefix` из настроек и
 * делегирует реальную работу git-модулю. Если папка не открыта, возвращает
 * понятную ошибку вместо падения.
 */
async function safeListBranches() {
    const cwd = (0, git_1.getWorkspaceCwd)();
    if (!cwd) {
        return {
            ok: false,
            reason: "no-folder",
            message: "Open a folder that contains a Git repository.",
        };
    }
    const { releasePrefix } = (0, settings_1.readSettings)();
    return (0, git_1.listReleaseBranches)(cwd, releasePrefix);
}
/**
 * Список всех веток репозитория (без префиксного фильтра).
 *
 * Загружается один раз и кэшируется webview'ем для мгновенного клиентского
 * поиска. Если папка не открыта — возвращаем понятную ошибку.
 */
async function safeListAllBranches() {
    const cwd = (0, git_1.getWorkspaceCwd)();
    if (!cwd) {
        return {
            ok: false,
            query: "",
            reason: "no-folder",
            message: "Open a folder that contains a Git repository.",
        };
    }
    return (0, git_1.listAllBranches)(cwd);
}
/**
 * Создать релизную ветку от `fromBranch` с именем `releasePrefix + releaseName`.
 *
 * Префикс берётся из настроек расширения (единый источник правды) и
 * нормализуется — гарантируется ровно один `/` между префиксом и названием.
 * Если папка не открыта — возвращаем понятную ошибку.
 */
async function safeCreateReleaseBranch(fromBranch, releaseName) {
    const cwd = (0, git_1.getWorkspaceCwd)();
    if (!cwd) {
        return {
            ok: false,
            reason: "git-error",
            message: "Open a folder that contains a Git repository.",
        };
    }
    const { releasePrefix } = (0, settings_1.readSettings)();
    const cleanPrefix = releasePrefix.endsWith("/")
        ? releasePrefix
        : `${releasePrefix}/`;
    const fullBranchName = `${cleanPrefix}${releaseName}`;
    return (0, git_1.createReleaseBranch)(cwd, fromBranch, fullBranchName);
}
/**
 * Переключиться на существующую ветку `fromBranch` (без создания новой).
 *
 * Используется для режима «Использовать ветку-источник как основную».
 * Если папка не открыта — возвращаем понятную ошибку.
 */
async function safeUseSourceBranch(fromBranch) {
    const cwd = (0, git_1.getWorkspaceCwd)();
    if (!cwd) {
        return {
            ok: false,
            reason: "git-error",
            message: "Open a folder that contains a Git repository.",
        };
    }
    return (0, git_1.checkoutExistingBranch)(cwd, fromBranch);
}
/**
 * Разрешить список query (SHA/сообщения) в реальные коммиты репозитория.
 *
 * Используется для наполнения правой панели экрана коммитов. Если папка не
 * открыта — возвращаем понятную ошибку.
 */
async function safeResolveCommits(upstreamBranch, queries) {
    const cwd = (0, git_1.getWorkspaceCwd)();
    if (!cwd) {
        return {
            ok: false,
            reason: "no-folder",
            message: "Open a folder that contains a Git repository.",
        };
    }
    return (0, git_1.resolveCommits)(cwd, upstreamBranch, queries);
}
/**
 * Применить один коммит через cherry-pick на ветку `branch`.
 *
 * Если `branch` задан и не является текущей — хост переключится на неё перед
 * применением. Если папка не открыта — возвращаем ошибку в формате результата.
 */
async function safeCherryPick(sha, branch) {
    const cwd = (0, git_1.getWorkspaceCwd)();
    if (!cwd) {
        return {
            sha,
            status: "error",
            files: [],
            message: "Open a folder that contains a Git repository.",
            branch: "",
        };
    }
    return (0, git_1.cherryPickCommit)(cwd, sha, branch);
}
/** Завершить cherry-pick после ручного резолва конфликта. */
async function safeCherryPickContinue() {
    const cwd = (0, git_1.getWorkspaceCwd)();
    if (!cwd) {
        return {
            status: "error",
            files: [],
            message: "Open a folder that contains a Git repository.",
        };
    }
    return (0, git_1.cherryPickContinue)(cwd);
}
/** Отменить незавершённый cherry-pick. */
async function safeCherryPickAbort() {
    const cwd = (0, git_1.getWorkspaceCwd)();
    if (!cwd) {
        return {
            ok: false,
            message: "Open a folder that contains a Git repository.",
        };
    }
    return (0, git_1.cherryPickAbort)(cwd);
}
//# sourceMappingURL=branches.js.map