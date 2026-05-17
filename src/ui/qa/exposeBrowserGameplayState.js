import { installBrowserGameplayTraceGlobals } from "./browserGameplayTrace.js";
import { collectBrowserGameplaySnapshot } from "./collectBrowserGameplaySnapshot.js";
import { appendSnapshotMergeSourceTrace } from "./traceSnapshotMergeSource.js";

export function exposeBrowserGameplayState() {
  if (typeof window === "undefined") return null;
  installBrowserGameplayTraceGlobals();
  window.__MGX_GET_GAMEPLAY_SNAPSHOT__ = collectBrowserGameplaySnapshot;
  window.__MGX_TRACE_SNAPSHOT_MERGE_SOURCE__ = appendSnapshotMergeSourceTrace;
  return {
    getSnapshot: window.__MGX_GET_GAMEPLAY_SNAPSHOT__,
    getSnapshotMergeSource: window.__MGX_TRACE_SNAPSHOT_MERGE_SOURCE__,
    clearTrace: window.__MGX_CLEAR_GAMEPLAY_TRACE__,
  };
}
