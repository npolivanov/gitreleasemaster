import * as vscode from "vscode";

/**
 * Обработчик команды `openScmView`.
 *
 * Открывает вкладку Source Control — чтобы пользователю было удобно разрешать
 * конфликты cherry-pick прямо в VS Code. Ответа вебвую не требует.
 */
export async function handleOpenScmView(): Promise<void> {
  await vscode.commands.executeCommand("workbench.view.scm");
}
