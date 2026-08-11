"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUseSourceBranch = handleUseSourceBranch;
const branches_1 = require("../branches");
/**
 * Обработчик команды `useSourceBranch`.
 *
 * Просто переключается на `fromBranch` (без создания новой ветки) — для режима
 * «Использовать ветку-источник как основную». Результат уходит в вебвюй теми
 * же событиями, что и при создании ветки: `releaseBranchCreated` (успех) или
 * `releaseBranchError` (провал).
 */
async function handleUseSourceBranch(message, deps) {
    const result = await (0, branches_1.safeUseSourceBranch)(message.data.fromBranch);
    if (result.ok) {
        deps.panel.webview.postMessage({ command: "releaseBranchCreated" });
        return;
    }
    deps.panel.webview.postMessage({
        command: "releaseBranchError",
        data: { message: result.message },
    });
}
//# sourceMappingURL=handleUseSourceBranch.js.map