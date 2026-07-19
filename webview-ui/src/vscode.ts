import type { OutboundMessage, InboundMessage } from "./types";

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  function acquireVsCodeApi(): VsCodeApi;
}

let api: VsCodeApi | null = null;

/** Lazily acquire and cache the VS Code webview API. */
export function getVsCodeApi(): VsCodeApi {
  if (!api) {
    api = acquireVsCodeApi();
  }
  return api;
}

/** Send a typed message to the extension host. */
export function postMessage(message: OutboundMessage): void {
  getVsCodeApi().postMessage(message);
}

/** Subscribe to messages from the extension host. Returns an unsubscribe fn. */
export function onMessage(handler: (message: InboundMessage) => void): () => void {
  const listener = (event: MessageEvent) => {
    const data = event.data as InboundMessage | undefined;
    if (data && typeof data === "object" && "command" in data) {
      handler(data);
    }
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
