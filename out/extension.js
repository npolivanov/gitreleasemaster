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
const fs = __importStar(require("fs"));
const git_1 = require("./git");
/** Configuration section exposed via `contributes.configuration`. */
const CONFIG_SECTION = "gitreleasemaster";
function activate(context) {
    const openUiCommand = vscode.commands.registerCommand("gitreleasemaster.openUI", () => {
        const panel = vscode.window.createWebviewPanel("gitReleaseMasterPanel", "Git Release Master", vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(context.extensionPath, "dist", "webview")),
            ],
        });
        panel.webview.html = getWebviewContent(panel.webview, context.extensionPath);
        const messageDisposable = panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case "getBranches":
                case "refreshBranches": {
                    const result = await safeListBranches();
                    panel.webview.postMessage({
                        command: "branchesUpdated",
                        data: result,
                    });
                    return;
                }
                case "getSettings": {
                    panel.webview.postMessage({
                        command: "settingsUpdated",
                        data: readSettings(),
                    });
                    return;
                }
                case "updateSettings": {
                    await applySettings(message.data);
                    // Broadcast the canonical (post-update) snapshot so every tab
                    // (General + JSON) renders the same values.
                    panel.webview.postMessage({
                        command: "settingsUpdated",
                        data: readSettings(),
                    });
                    return;
                }
                case "noopCreateRelease": {
                    vscode.window.showInformationMessage("Создание релиза пока не реализовано (NOOP).");
                    return;
                }
            }
        }, undefined, context.subscriptions);
        // Keep the webview in sync if settings are changed from VS Code's UI.
        const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(CONFIG_SECTION)) {
                panel.webview.postMessage({
                    command: "settingsUpdated",
                    data: readSettings(),
                });
            }
        }, undefined, context.subscriptions);
        panel.onDidDispose(() => {
            messageDisposable.dispose();
            configDisposable.dispose();
        }, null, context.subscriptions);
    });
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(package) Git Release Master";
    statusBarItem.tooltip = "Открыть Git Release Master";
    statusBarItem.command = "gitreleasemaster.openUI";
    statusBarItem.show();
    context.subscriptions.push(openUiCommand, statusBarItem);
}
/** Read all settings under our config section. */
function readSettings() {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return {
        releasePrefix: config.get("releasePrefix", "release/"),
        theme: config.get("theme", "dark"),
        language: config.get("language", "ru"),
    };
}
/** Persist a partial settings update at the Global (user) target. */
async function applySettings(patch) {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await Promise.all(Object.entries(patch).map(([key, value]) => config.update(`${CONFIG_SECTION}.${key}`, value, vscode.ConfigurationTarget.Global)));
}
/** Wrap git access with friendly error handling. */
async function safeListBranches() {
    const cwd = (0, git_1.getWorkspaceCwd)();
    if (!cwd) {
        return {
            ok: false,
            reason: "no-folder",
            message: "Open a folder that contains a Git repository.",
        };
    }
    const { releasePrefix } = readSettings();
    return (0, git_1.listReleaseBranches)(cwd, releasePrefix);
}
function getWebviewContent(webview, extensionPath) {
    const webviewPath = path.join(extensionPath, "dist", "webview");
    const indexPath = path.join(webviewPath, "index.html");
    if (!fs.existsSync(indexPath)) {
        return `<h1 style="color: red; padding: 20px; font-family: sans-serif;">Ошибка: сборка не найдена. Запустите 'npm run build-webview'.</h1>`;
    }
    let html = fs.readFileSync(indexPath, "utf-8");
    // Rewrite relative asset URLs so they resolve through the webview URI scheme.
    html = html.replace(/(href|src)="\.\/([^"]+)"/g, (_, attr, filePath) => {
        const fileUri = webview.asWebviewUri(vscode.Uri.joinPath(vscode.Uri.file(webviewPath), filePath));
        return `${attr}="${fileUri}"`;
    });
    return html;
}
function deactivate() { }
//# sourceMappingURL=extension.js.map