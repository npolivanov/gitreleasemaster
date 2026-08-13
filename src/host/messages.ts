import type * as vscode from "vscode";
import type { Settings } from "./settings";
import type {
  ListBranchesResult,
  BranchSearchResult,
  ResolveCommitsResult,
} from "../git";

/** Сообщения, приходящие от вебвюя (входящие команды). */
export type InboundMessage =
  | { command: "getBranches" }
  | { command: "refreshBranches" }
  | { command: "getAllBranches" }
  | { command: "createReleaseBranch"; data: { fromBranch: string; releaseName: string } }
  | { command: "useSourceBranch"; data: { fromBranch: string } }
  | { command: "resolveCommits"; data: { upstreamBranch: string; queries: string[] } }
  | { command: "getSettings" }
  | { command: "updateSettings"; data: Partial<Settings> }
  | { command: "noopCreateRelease" };

/** Сообщения, отправляемые вебвюю (исходящие события). */
export type OutboundMessage =
  | { command: "branchesUpdated"; data: ListBranchesResult }
  | { command: "allBranchesLoaded"; data: BranchSearchResult }
  | { command: "releaseBranchCreated" }
  | { command: "releaseBranchError"; data: { message: string } }
  | { command: "commitsResolved"; data: ResolveCommitsResult }
  | { command: "settingsUpdated"; data: Settings };

/**
 * Зависимости обработчиков команд. Передаются маршрутизатором, чтобы хендлеры
 * не зависели от глобального состояния и их было проще тестировать.
 */
export interface HandlerDeps {
  /** Панель вебвюя, куда отправляются исходящие сообщения. */
  panel: vscode.WebviewPanel;
  /** Контекст расширения (нужен для globalState). */
  context: vscode.ExtensionContext;
  /**
   * Запросить свежий список веток и отправить его в вебвюй как `branchesUpdated`.
   * Используется при первичной загрузке, ручном обновлении и автоперевызове
   * после смены `releasePrefix`.
   */
  refreshBranches: () => Promise<void>;
}
