import { installBrowserGameplayTraceGlobals } from "./browserGameplayTrace.js";
import { collectBrowserGameplaySnapshot } from "./collectBrowserGameplaySnapshot.js";

export function exposeBrowserGameplayState() {
  if (typeof window === "undefined") return null;
  installBrowserGameplayTraceGlobals();
  window.__MGX_GET_GAMEPLAY_SNAPSHOT__ = collectBrowserGameplaySnapshot;
  return {
    getSnapshot: window.__MGX_GET_GAMEPLAY_SNAPSHOT__,
    clearTrace: window.__MGX_CLEAR_GAMEPLAY_TRACE__,
  };
}

