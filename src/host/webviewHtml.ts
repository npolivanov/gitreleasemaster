import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * Сгенерировать HTML содержимого панели вебвюя.
 *
 * Читает собранный `dist/webview/index.html` и переписывает относительные
 * ссылки на ассеты (`href="./..."` / `src="./..."`) в webview-URI, чтобы они
 * корректно разрешались через схему webview. Если сборка отсутствует —
 * возвращает сообщение об ошибке.
 */
export function getWebviewContent(
  webview: vscode.Webview,
  extensionPath: string,
): string {
  const webviewPath = path.join(extensionPath, "dist", "webview");
  const indexPath = path.join(webviewPath, "index.html");

  if (!fs.existsSync(indexPath)) {
    return `<h1 style="color: red; padding: 20px; font-family: sans-serif;">Ошибка: сборка не найдена. Запустите 'npm run build-webview'.</h1>`;
  }

  let html = fs.readFileSync(indexPath, "utf-8");

  // Переписываем относительные URL ассетов через webview-URI.
  html = html.replace(/(href|src)="\.\/([^"]+)"/g, (_, attr, filePath) => {
    const fileUri = webview.asWebviewUri(
      vscode.Uri.joinPath(vscode.Uri.file(webviewPath), filePath),
    );
    return `${attr}="${fileUri}"`;
  });

  return html;
}
