import { buildMobileFreezeReport } from "./mobileFreezeDetector.js";

function downloadJson(filename, payload) {
  if (typeof document === "undefined") return false;
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

export function exportMobileFreezeReport(options = {}) {
  const report = buildMobileFreezeReport(options);
  if (!report || typeof window === "undefined") return null;
  window.__MGX_LAST_FREEZE_REPORT__ = report;
  downloadJson(`mgx-freeze-report-${report.bugId}-${Date.now()}.json`, report);
  return report;
}

export async function recoverOrRefreshMobileQa(options = {}) {
  const before = buildMobileFreezeReport({ label: "qa-recover-before", ...options });
  let recovered = false;
  const classification = String(before?.classification ?? "");
  const shouldForceRound =
    classification === "WAITING_WITH_NO_PENDING_ACTORS" ||
    classification === "WAITING_AFTER_ROUND_SHOULD_CLOSE" ||
    classification === "WAITING_FOR_FOLDED_ACTOR" ||
    classification === "WAITING_FOR_ALLIN_ACTOR" ||
    classification === "WAITING_FOR_INELIGIBLE_ACTOR";

  if (shouldForceRound && typeof window !== "undefined") {
    recovered = Boolean(window.__BADUGI_E2E__?.forceFinishRoundForTest?.(before?.phase ?? "BET"));
  }

  await new Promise((resolve) => setTimeout(resolve, recovered ? 350 : 0));
  const after = buildMobileFreezeReport({ label: "qa-recover-after", ...options });
  if (typeof window !== "undefined") {
    window.__MGX_LAST_RECOVERY_REPORT__ = { before, after, recovered };
  }
  return { before, after, recovered };
}

export function installMobileQaRecoveryGlobals() {
  if (typeof window === "undefined") return null;
  window.__MGX_EXPORT_MOBILE_FREEZE_REPORT__ = exportMobileFreezeReport;
  window.__MGX_RECOVER_MOBILE_QA__ = recoverOrRefreshMobileQa;
  return {
    exportFreezeReport: window.__MGX_EXPORT_MOBILE_FREEZE_REPORT__,
    recover: window.__MGX_RECOVER_MOBILE_QA__,
  };
}
