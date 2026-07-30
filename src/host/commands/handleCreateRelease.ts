import * as vscode from "vscode";
import type { HandlerDeps } from "../messages";

/**
 * Обработчик команды `noopCreateRelease`.
 *
 * Заглушка создания релиза: пока функциональность не реализована, показываем
 * пользователю информационное сообщение.
 */
export async function handleCreateRelease(_deps: HandlerDeps): Promise<void> {
  await vscode.window.showInformationMessage(
    "Создание релиза пока не реализовано (NOOP).",
  );
}
