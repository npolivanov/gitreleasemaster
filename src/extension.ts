import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  getWorkspaceCwd,
  listReleaseBranches,
  type ListBranchesResult,
} from "./git";

/** Configuration section exposed via `contributes.configuration`. */
const CONFIG_SECTION = "gitreleasemaster";

/** Shape of the settings object shared with the webview. */
interface Settings {
  releasePrefix: string;
  theme: "dark" | "light";
  language: "ru" | "en";
}

/** Inbound messages from the webview. */
type InboundMessage =
  | { command: "getBranches" }
  | { command: "refreshBranches" }
  | { command: "getSettings" }
  | { command: "updateSettings"; data: Partial<Settings> }
  | { command: "noopCreateRelease" };

export function activate(context: vscode.ExtensionContext) {
  const openUiCommand = vscode.commands.registerCommand(
    "gitreleasemaster.openUI",
    () => {
      const panel = vscode.window.createWebviewPanel(
        "gitReleaseMasterPanel",
        "Git Release Master",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, "dist", "webview")),
          ],
        },
      );

      panel.webview.html = getWebviewContent(panel.webview, context.extensionPath);

      const messageDisposable = panel.webview.onDidReceiveMessage(
        async (message: InboundMessage) => {
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
              vscode.window.showInformationMessage(
                "Создание релиза пока не реализовано (NOOP).",
              );
              return;
            }
          }
        },
        undefined,
        context.subscriptions,
      );

      // Keep the webview in sync if settings are changed from VS Code's UI.
      const configDisposable = vscode.workspace.onDidChangeConfiguration(
        (e) => {
          if (e.affectsConfiguration(CONFIG_SECTION)) {
            panel.webview.postMessage({
              command: "settingsUpdated",
              data: readSettings(),
            });
          }
        },
        undefined,
        context.subscriptions,
      );

      panel.onDidDispose(
        () => {
          messageDisposable.dispose();
          configDisposable.dispose();
        },
        null,
        context.subscriptions,
      );
    },
  );

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  statusBarItem.text = "$(package) Git Release Master";
  statusBarItem.tooltip = "Открыть Git Release Master";
  statusBarItem.command = "gitreleasemaster.openUI";
  statusBarItem.show();

  context.subscriptions.push(openUiCommand, statusBarItem);
}

/** Read all settings under our config section. */
function readSettings(): Settings {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    releasePrefix: config.get<string>("releasePrefix", "release/"),
    theme: config.get<"dark" | "light">("theme", "dark"),
    language: config.get<"ru" | "en">("language", "ru"),
  };
}

/** Persist a partial settings update at the Global (user) target. */
async function applySettings(patch: Partial<Settings>): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  await Promise.all(
    Object.entries(patch).map(([key, value]) =>
      config.update(
        `${CONFIG_SECTION}.${key}`,
        value,
        vscode.ConfigurationTarget.Global,
      ),
    ),
  );
}

/** Wrap git access with friendly error handling. */
async function safeListBranches(): Promise<ListBranchesResult> {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    return {
      ok: false,
      reason: "no-folder",
      message: "Open a folder that contains a Git repository.",
    };
  }
  const { releasePrefix } = readSettings();
  return listReleaseBranches(cwd, releasePrefix);
}

function getWebviewContent(
  webview: vscode.Webview,
  extensionPath: string,
): string {
  const webviewPath = path.join(extensionPath, "dist", "webview");
  const indexPath = path.join(webviewPath, "index.html");

  if (!fs.existsSync(indexPath)) {
    return `<h1 style="color: red; padding: 20px; font-family: sans-serif;">Ошибка: сборка не найдена. Запустите 'npm run build-webview'.</h1>`;
  }

  let html = fs.readFileSync(indexPath, "utf-8");

  // Rewrite relative asset URLs so they resolve through the webview URI scheme.
  html = html.replace(/(href|src)="\.\/([^"]+)"/g, (_, attr, filePath) => {
    const fileUri = webview.asWebviewUri(
      vscode.Uri.joinPath(vscode.Uri.file(webviewPath), filePath),
    );
    return `${attr}="${fileUri}"`;
  });

  return html;
}

export function deactivate() {}
