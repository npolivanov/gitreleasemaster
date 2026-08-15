import * as vscode from "vscode";
import * as path from "path";
import { getWebviewContent } from "./host/webviewHtml";
import { dispatchCommand } from "./host/messageRouter";
import { safeListBranches } from "./host/branches";
import {
  CONFIG_SECTION,
  cacheSettings,
  readSettings,
} from "./host/settings";
import type { InboundMessage, HandlerDeps } from "./host/messages";

/**
 * Точка входа расширения.
 *
 * Регистрирует команду открытия панели, статус-бар и настраивает связь
 * с вебвуем. Вся логика обработки команд вынесена в `./host/` — здесь только
 * оркестрация: создание панели, маршрутизация сообщений и подписки.
 */
export function activate(context: vscode.ExtensionContext) {
  const openUiCommand = vscode.commands.registerCommand(
    "gitreleasemaster.openUI",
    () => openWebviewPanel(context),
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

/**
 * Создать и настроить панель вебвюя: загрузить HTML, подключить обработчик
 * входящих сообщений и подписку на внешние изменения настроек.
 */
function openWebviewPanel(context: vscode.ExtensionContext): void {
  const panel = vscode.window.createWebviewPanel(
    "gitReleaseMasterPanel",
    "Git Release Master",
    vscode.ViewColumn.One,
    {
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
    },
  );

  panel.webview.html = getWebviewContent(panel.webview, context.extensionPath);

  // Запросить свежий список веток и отправить его в вебвюй как branchesUpdated.
  const refreshBranches = async (): Promise<void> => {
    panel.webview.postMessage({
      command: "branchesUpdated",
      data: await safeListBranches(),
    });
  };

  // Зависимости обработчиков: панель, контекст и колбэк обновления веток.
  const deps: HandlerDeps = { panel, context, refreshBranches };

  // Маршрутизация входящих сообщений от вебвюя.
  const messageDisposable = panel.webview.onDidReceiveMessage(
    async (message: InboundMessage) => {
      await dispatchCommand(message, deps);
    },
    undefined,
    context.subscriptions,
  );

  // Держать вебвуй в синхроне при изменении настроек через UI самого VS Code.
  const configDisposable = vscode.workspace.onDidChangeConfiguration(
    async (e) => {
      if (!e.affectsConfiguration(CONFIG_SECTION)) {
        return;
      }
      const settings = readSettings();
      // Зеркалим внешние изменения в кэш, чтобы он не устаревал.
      await cacheSettings(context, settings);
      panel.webview.postMessage({
        command: "settingsUpdated",
        data: settings,
      });
      // Если сменился префикс — обновляем ветки и здесь.
      // (внешний путь меняет конфиг напрямую, поэтому сравнивать не с чем —
      // просто перевызываем, как и при редактировании из вебвюя)
      await refreshBranches();
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
}

export function deactivate() {}
