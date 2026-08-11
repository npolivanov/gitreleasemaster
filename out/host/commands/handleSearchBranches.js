"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSearchBranches = handleSearchBranches;
const branches_1 = require("../branches");
/**
 * Обработчик команды `searchBranches`.
 *
 * Ищет ветки по подстроке во всём репозитории (без префиксного фильтра) и
 * отправляет результат в вебвюй как событие `branchesSearched`. Эхо `query`
 * в ответе позволяет вебвую отсеять устаревшие ответы.
 */
async function handleSearchBranches(message, deps) {
    const result = await (0, branches_1.safeSearchBranches)(message.data.query);
    deps.panel.webview.postMessage({
        command: "branchesSearched",
        data: result,
    });
}
//# sourceMappingURL=handleSearchBranches.js.map