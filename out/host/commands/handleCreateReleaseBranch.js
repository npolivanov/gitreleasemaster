"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCreateReleaseBranch = handleCreateReleaseBranch;
const branches_1 = require("../branches");
/**
 * Обработчик команды `createReleaseBranch`.
 *
 * Создаёт релизную ветку от `fromBranch` с именем `releasePrefix + releaseName`
 * и переключается на неё. Результат уходит в вебвюй как `releaseBranchCreated`
 * (успех) или `releaseBranchError` (провал — например, ветка уже существует).
 */
async function handleCreateReleaseBranch(message, deps) {
    // Временная диагностика — видна в Output → Extension Host.
    // Поможет понять, доходит ли запрос и чем заканчивается.
    console.log("[Git Release Master] createReleaseBranch:", message.data.fromBranch, "->", message.data.releaseName);
    const result = await (0, branches_1.safeCreateReleaseBranch)(message.data.fromBranch, message.data.releaseName);
    console.log("[Git Release Master] createReleaseBranch result:", result);
    if (result.ok) {
        deps.panel.webview.postMessage({ command: "releaseBranchCreated" });
        return;
    }
    deps.panel.webview.postMessage({
        command: "releaseBranchError",
        data: { message: result.message },
    });
}
//# sourceMappingURL=handleCreateReleaseBranch.js.map