"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeListBranches = safeListBranches;
exports.safeListAllBranches = safeListAllBranches;
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
//# sourceMappingURL=branches.js.map