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
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const webviewHtml_1 = require("./host/webviewHtml");
const messageRouter_1 = require("./host/messageRouter");
const branches_1 = require("./host/branches");
const settings_1 = require("./host/settings");
/**
 * Точка входа расширения.
 *
 * Регистрирует команду открытия панели, статус-бар и настраивает связь
 * с вебвуем. Вся логика обработки команд вынесена в `./host/` — здесь только
 * оркестрация: создание панели, маршрутизация сообщений и подписки.
 */
function activate(context) {
    const openUiCommand = vscode.commands.registerCommand("gitreleasemaster.openUI", () => openWebviewPanel(context));
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(package) Git Release Master";
    statusBarItem.tooltip = "Открыть Git Release Master";
    statusBarItem.command = "gitreleasemaster.openUI";
    statusBarItem.show();
    context.subscriptions.push(openUiCommand, statusBarItem);
}
/**
 * Создать и настроить панель вебвюя: загрузить HTML, подключить обработчик
 * входящих сообщений и подписку на внешние изменения настроек.
 */
function openWebviewPanel(context) {
    const panel = vscode.window.createWebviewPanel("gitReleaseMasterPanel", "Git Release Master", vscode.ViewColumn.One, {
        enableScripts: true,
        // Не выгружать webview при переключении вкладок (например, когда
        // пользователь уходит в Source Control резолвить конфликты cherry-pick):
        // иначе при возврате приложение перезагружается с нуля и wizard
        // сбрасывается на главный экран. Платим памятью — для панели инструмента
        // это приемлемо.
        retainContextWhenHidden: true,
        localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, "dist", "webview")),
        ],
    });
    panel.webview.html = (0, webviewHtml_1.getWebviewContent)(panel.webview, context.extensionPath);
    // Запросить свежий список веток и отправить его в вебвюй как branchesUpdated.
    const refreshBranches = async () => {
        panel.webview.postMessage({
            command: "branchesUpdated",
            data: await (0, branches_1.safeListBranches)(),
        });
    };
    // Зависимости обработчиков: панель, контекст и колбэк обновления веток.
    const deps = { panel, context, refreshBranches };
    // Маршрутизация входящих сообщений от вебвюя.
    const messageDisposable = panel.webview.onDidReceiveMessage(async (message) => {
        await (0, messageRouter_1.dispatchCommand)(message, deps);
    }, undefined, context.subscriptions);
    // Держать вебвуй в синхроне при изменении настроек через UI самого VS Code.
    const configDisposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (!e.affectsConfiguration(settings_1.CONFIG_SECTION)) {
            return;
        }
        const settings = (0, settings_1.readSettings)();
        // Зеркалим внешние изменения в кэш, чтобы он не устаревал.
        await (0, settings_1.cacheSettings)(context, settings);
        panel.webview.postMessage({
            command: "settingsUpdated",
            data: settings,
        });
        // Если сменился префикс — обновляем ветки и здесь.
        // (внешний путь меняет конфиг напрямую, поэтому сравнивать не с чем —
        // просто перевызываем, как и при редактировании из вебвюя)
        await refreshBranches();
    }, undefined, context.subscriptions);
    panel.onDidDispose(() => {
        messageDisposable.dispose();
        configDisposable.dispose();
    }, null, context.subscriptions);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map