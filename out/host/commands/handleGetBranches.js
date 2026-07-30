"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetBranches = handleGetBranches;
const branches_1 = require("../branches");
/**
 * Обработчик команд `getBranches` и `refreshBranches`.
 *
 * Запрашивает актуальный список релизных веток и отправляет его в вебвюй
 * как событие `branchesUpdated`. Логика одинакова для обеих команд: разница
 * лишь в том, что `refreshBranches` подразумевает ручное обновление.
 */
async function handleGetBranches(_deps) {
    const result = await (0, branches_1.safeListBranches)();
    _deps.panel.webview.postMessage({
        command: "branchesUpdated",
        data: result,
    });
}
//# sourceMappingURL=handleGetBranches.js.map