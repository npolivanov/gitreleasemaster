"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetAllBranches = handleGetAllBranches;
const branches_1 = require("../branches");
/**
 * Обработчик команды `getAllBranches`.
 *
 * Отдаёт вебвую ВСЕ ветки репозитория (без префиксного фильтра и без поиска)
 * одним списком как событие `allBranchesLoaded`. Вебвуй кэширует результат и
 * дальше фильтрует его клиентски — мгновенно, без запросов при каждом вводе.
 */
async function handleGetAllBranches(deps) {
    const result = await (0, branches_1.safeListAllBranches)();
    deps.panel.webview.postMessage({
        command: "allBranchesLoaded",
        data: result,
    });
}
//# sourceMappingURL=handleGetAllBranches.js.map