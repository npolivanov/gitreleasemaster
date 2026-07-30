"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchCommand = dispatchCommand;
const handleGetBranches_1 = require("./commands/handleGetBranches");
const handleGetSettings_1 = require("./commands/handleGetSettings");
const handleUpdateSettings_1 = require("./commands/handleUpdateSettings");
const handleCreateRelease_1 = require("./commands/handleCreateRelease");
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