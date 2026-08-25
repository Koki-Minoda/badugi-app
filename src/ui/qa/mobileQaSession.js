import { summarizeCpuDecisionTrace } from "../../ai/qa/summarizeCpuDecisionTrace.js";

const SESSION_KEY = "mgx.qa.sessionId";

function createSessionId() {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `qa-${Date.now()}-${random}`;
}

export function getMobileQaSessionId() {
  if (typeof window === "undefined") return "qa-server";
  try {
    const existing = window.localStorage?.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = createSessionId();
    window.localStorage?.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return createSessionId();
  }
}

export function resetMobileQaSessionId() {
  if (typeof window === "undefined") return "qa-server";
  const next = createSessionId();
  try {
    window.localStorage?.setItem(SESSION_KEY, next);
  } catch {
    // Ignore storage failures; QA export still includes the generated value.
  }
  return next;
}

export function getCpuDecisionSessionSummary({ limit = 20 } = {}) {
  if (typeof window === "undefined") {
    return { sessionId: "qa-server", summary: summarizeCpuDecisionTrace([]), lastDecisions: [] };
  }
  const sessionId = getMobileQaSessionId();
  const rows = Array.isArray(window.__MGX_CPU_DECISION_TRACE__)
    ? window.__MGX_CPU_DECISION_TRACE__
    : [];
  const sessionRows = rows.filter((row) => {
    const rowSession = row?.sessionId ?? row?.cpuDecision?.sessionId;
    return !rowSession || rowSession === sessionId;
  });
  const lastDecisions = sessionRows.slice(-limit).map((row) => ({
    variantId: row.variantId ?? "unknown",
    mode: row.mode ?? "unknown",
    seat: row.seat ?? row.actorSeat ?? null,
    phase: row.phase ?? row.street ?? null,
    decisionSource: row.decisionSource ?? "unknown",
    finalAction: row.finalAction ?? row.selectedAction ?? "unknown",
    legalActions: Array.isArray(row.legalActions) ? row.legalActions : [],
    fallbackReason: row.fallbackReason ?? null,
  }));
  return {
    sessionId,
    summary: summarizeCpuDecisionTrace(sessionRows),
    lastDecisions,
  };
}

export function exportMobileQaSessionReport() {
  const report = getCpuDecisionSessionSummary({ limit: 50 });
  if (typeof window !== "undefined") {
    window.__MGX_LAST_CPU_SESSION_REPORT__ = report;
    if (typeof document !== "undefined") {
      const blob = new Blob([`${JSON.stringify(report, null, 2)}\n`], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mgx-cpu-session-${report.sessionId}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
  }
  return report;
}
