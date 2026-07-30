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
exports.getWebviewContent = getWebviewContent;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/**
 * Сгенерировать HTML содержимого панели вебвюя.
 *
 * Читает собранный `dist/webview/index.html` и переписывает относительные
 * ссылки на ассеты (`href="./..."` / `src="./..."`) в webview-URI, чтобы они
 * корректно разрешались через схему webview. Если сборка отсутствует —
 * возвращает сообщение об ошибке.
 */
function getWebviewContent(webview, extensionPath) {
    const webviewPath = path.join(extensionPath, "dist", "webview");
    const indexPath = path.join(webviewPath, "index.html");
    if (!fs.existsSync(indexPath)) {
        return `<h1 style="color: red; padding: 20px; font-family: sans-serif;">Ошибка: сборка не найдена. Запустите 'npm run build-webview'.</h1>`;
    }
    let html = fs.readFileSync(indexPath, "utf-8");
    // Переписываем относительные URL ассетов через webview-URI.
    html = html.replace(/(href|src)="\.\/([^"]+)"/g, (_, attr, filePath) => {
        const fileUri = webview.asWebviewUri(vscode.Uri.joinPath(vscode.Uri.file(webviewPath), filePath));
        return `${attr}="${fileUri}"`;
    });
    return html;
}
//# sourceMappingURL=webviewHtml.js.map