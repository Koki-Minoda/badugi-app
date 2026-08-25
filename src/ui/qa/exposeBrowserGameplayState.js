import { installBrowserGameplayTraceGlobals } from "./browserGameplayTrace.js";
import { collectBrowserGameplaySnapshot } from "./collectBrowserGameplaySnapshot.js";
import { appendSnapshotMergeSourceTrace } from "./traceSnapshotMergeSource.js";
import { installMobileFreezeDetectorGlobals } from "./mobileFreezeDetector.js";
import { installMobileQaRecoveryGlobals } from "./mobileQaRecovery.js";

export function exposeBrowserGameplayState() {
  if (typeof window === "undefined") return null;
  installBrowserGameplayTraceGlobals();
  installMobileFreezeDetectorGlobals();
  installMobileQaRecoveryGlobals();
  window.__MGX_GET_GAMEPLAY_SNAPSHOT__ = collectBrowserGameplaySnapshot;
  window.__MGX_TRACE_SNAPSHOT_MERGE_SOURCE__ = appendSnapshotMergeSourceTrace;
  return {
    getSnapshot: window.__MGX_GET_GAMEPLAY_SNAPSHOT__,
    getSnapshotMergeSource: window.__MGX_TRACE_SNAPSHOT_MERGE_SOURCE__,
    getFreezeReport: window.__MGX_EXPORT_FREEZE_REPORT__,
    recoverMobileQa: window.__MGX_RECOVER_MOBILE_QA__,
    clearTrace: window.__MGX_CLEAR_GAMEPLAY_TRACE__,
  };
}
