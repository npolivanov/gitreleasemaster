import { useCallback, useEffect, useState } from "react";
import type { ListBranchesResult } from "../../../types";
import { onMessage, postMessage } from "../../../vscode";

interface BranchesState {
  loading: boolean;
  result: ListBranchesResult | null;
}

/**
 * Loads release branches from the host and exposes a refresh action.
 * The host pushes a fresh snapshot whenever the extension replies.
 */
export function useBranches() {
  const [state, setState] = useState<BranchesState>({
    loading: true,
    result: null,
  });

  useEffect(() => {
    postMessage({ command: "getBranches" });
    const unsubscribe = onMessage((message) => {
      if (message.command === "branchesUpdated") {
        setState({ loading: false, result: message.data });
      }
    });
    return unsubscribe;
  }, []);

  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true }));
    postMessage({ command: "refreshBranches" });
  }, []);

  return { ...state, refresh };
}
