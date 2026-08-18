import type { InboundMessage, HandlerDeps } from "./messages";
import { handleGetBranches } from "./commands/handleGetBranches";
import { handleGetSettings } from "./commands/handleGetSettings";
import { handleUpdateSettings } from "./commands/handleUpdateSettings";
import { handleCreateRelease } from "./commands/handleCreateRelease";
import { handleGetAllBranches } from "./commands/handleGetAllBranches";
import { handleCreateReleaseBranch } from "./commands/handleCreateReleaseBranch";
import { handleUseSourceBranch } from "./commands/handleUseSourceBranch";
import { handleResolveCommits } from "./commands/handleResolveCommits";
import { handleCherryPick } from "./commands/handleCherryPick";
import { handleCherryPickAbort } from "./commands/handleCherryPickAbort";
import { handleRevert } from "./commands/handleRevert";
import { handleRevertAbort } from "./commands/handleRevertAbort";
import { handleGetBranchLog } from "./commands/handleGetBranchLog";
import { handleOpenScmView } from "./commands/handleOpenScmView";

/**
 * Маршрутизатор входящих сообщений от вебвюя.
 *
 * По команде из сообщения выбирает нужный обработчик и передаёт ему зависимости.
 * Каждый обработчик живёт в отдельном файле — здесь только диспетчеризация.
 */
export async function dispatchCommand(
  message: InboundMessage,
  deps: HandlerDeps,
): Promise<void> {
  switch (message.command) {
    case "getBranches":
    case "refreshBranches":
      await handleGetBranches(deps);
      return;

    case "getAllBranches":
      await handleGetAllBranches(deps);
      return;

    case "createReleaseBranch":
      await handleCreateReleaseBranch(message, deps);
      return;

    case "useSourceBranch":
      await handleUseSourceBranch(message, deps);
      return;

    case "resolveCommits":
      await handleResolveCommits(message, deps);
      return;

    case "cherryPick":
      await handleCherryPick(message, deps);
      return;

    case "cherryPickAbort":
      await handleCherryPickAbort(deps);
      return;

    case "revert":
      await handleRevert(message, deps);
      return;

    case "revertAbort":
      await handleRevertAbort(deps);
      return;

    case "getBranchLog":
      await handleGetBranchLog(message, deps);
      return;

    case "openScmView":
      await handleOpenScmView();
      return;

    case "getSettings":
      await handleGetSettings(deps);
      return;

    case "updateSettings":
      await handleUpdateSettings(message, deps);
      return;

    case "noopCreateRelease":
      await handleCreateRelease(deps);
      return;
  }
}
