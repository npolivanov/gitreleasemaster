"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchCommand = dispatchCommand;
const handleGetBranches_1 = require("./commands/handleGetBranches");
const handleGetSettings_1 = require("./commands/handleGetSettings");
const handleUpdateSettings_1 = require("./commands/handleUpdateSettings");
const handleCreateRelease_1 = require("./commands/handleCreateRelease");
const handleGetAllBranches_1 = require("./commands/handleGetAllBranches");
const handleCreateReleaseBranch_1 = require("./commands/handleCreateReleaseBranch");
const handleUseSourceBranch_1 = require("./commands/handleUseSourceBranch");
const handleResolveCommits_1 = require("./commands/handleResolveCommits");
const handleCherryPick_1 = require("./commands/handleCherryPick");
const handleCherryPickAbort_1 = require("./commands/handleCherryPickAbort");
const handleRevert_1 = require("./commands/handleRevert");
const handleRevertAbort_1 = require("./commands/handleRevertAbort");
const handleGetBranchLog_1 = require("./commands/handleGetBranchLog");
const handleOpenScmView_1 = require("./commands/handleOpenScmView");
/**
 * Маршрутизатор входящих сообщений от вебвюя.
 *
 * По команде из сообщения выбирает нужный обработчик и передаёт ему зависимости.
 * Каждый обработчик живёт в отдельном файле — здесь только диспетчеризация.
 */
async function dispatchCommand(message, deps) {
    switch (message.command) {
        case "getBranches":
        case "refreshBranches":
            await (0, handleGetBranches_1.handleGetBranches)(deps);
            return;
        case "getAllBranches":
            await (0, handleGetAllBranches_1.handleGetAllBranches)(deps);
            return;
        case "createReleaseBranch":
            await (0, handleCreateReleaseBranch_1.handleCreateReleaseBranch)(message, deps);
            return;
        case "useSourceBranch":
            await (0, handleUseSourceBranch_1.handleUseSourceBranch)(message, deps);
            return;
        case "resolveCommits":
            await (0, handleResolveCommits_1.handleResolveCommits)(message, deps);
            return;
        case "cherryPick":
            await (0, handleCherryPick_1.handleCherryPick)(message, deps);
            return;
        case "cherryPickAbort":
            await (0, handleCherryPickAbort_1.handleCherryPickAbort)(deps);
            return;
        case "revert":
            await (0, handleRevert_1.handleRevert)(message, deps);
            return;
        case "revertAbort":
            await (0, handleRevertAbort_1.handleRevertAbort)(deps);
            return;
        case "getBranchLog":
            await (0, handleGetBranchLog_1.handleGetBranchLog)(message, deps);
            return;
        case "openScmView":
            await (0, handleOpenScmView_1.handleOpenScmView)();
            return;
        case "getSettings":
            await (0, handleGetSettings_1.handleGetSettings)(deps);
            return;
        case "updateSettings":
            await (0, handleUpdateSettings_1.handleUpdateSettings)(message, deps);
            return;
        case "noopCreateRelease":
            await (0, handleCreateRelease_1.handleCreateRelease)(deps);
            return;
    }
}
//# sourceMappingURL=messageRouter.js.map