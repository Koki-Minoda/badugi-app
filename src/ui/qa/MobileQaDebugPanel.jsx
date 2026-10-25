import React, { useState } from "react";
import {
  exportMobileFreezeReport,
  recoverOrRefreshMobileQa,
} from "./mobileQaRecovery.js";
import {
  exportMobileQaSessionReport,
  getCpuDecisionSessionSummary,
  getMobileQaSessionId,
} from "./mobileQaSession.js";

export default function MobileQaDebugPanel({ enabled = false, onReturnToMenu }) {
  const [lastStatus, setLastStatus] = useState("Ready");
  const [lastClassification, setLastClassification] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [cpuSession, setCpuSession] = useState(() => ({
    sessionId: getMobileQaSessionId(),
    summary: null,
    lastDecisions: [],
  }));

  if (!enabled) return null;

  const handleExport = () => {
    const report = exportMobileFreezeReport();
    setLastClassification(report?.classification ?? "NO_REPORT");
    setLastStatus(report ? "Freeze report exported" : "Export failed");
  };

  const handleCpuExport = () => {
    const report = exportMobileQaSessionReport();
    setCpuSession(report);
    setLastStatus("CPU session report exported");
  };

  const handleRecover = async () => {
    setLastStatus("Refreshing...");
    const result = await recoverOrRefreshMobileQa();
    setLastClassification(result?.after?.classification ?? "NO_REPORT");
    setLastStatus(result?.recovered ? "Recovery attempted" : "Snapshot refreshed");
  };

  const refreshCpuSession = () => {
    setCpuSession(getCpuDecisionSessionSummary({ limit: 20 }));
  };

  const summary = cpuSession?.summary;
  const totals = summary?.totals ?? {};

  return (
    <div
      data-testid="mobile-qa-debug-panel"
      className={`fixed right-2 top-14 landscape:bottom-2 landscape:top-auto z-[9999] text-xs text-white ${
        expanded
          ? "w-[min(92vw,320px)] rounded-lg border border-amber-300/50 bg-slate-950/95 p-2 shadow-2xl"
          : "h-11 w-11"
      }`}
    >
      <button
        type="button"
        className={`flex items-center rounded border border-amber-300/50 bg-slate-950/95 font-bold text-amber-200 ${
          expanded
            ? "w-full justify-between gap-2 px-2 py-1 text-left"
            : "h-11 w-11 justify-center shadow-lg"
        }`}
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-label={expanded ? "Hide QA tools" : "Open QA tools"}
      >
        <span>{expanded ? "MGX Mobile QA" : "QA"}</span>
        {expanded && <span className="text-[10px] text-slate-300">Hide</span>}
      </button>
      {expanded && (
        <>
      <div className="mb-2 text-[11px] text-slate-300">
        {lastStatus}
        {lastClassification ? ` / ${lastClassification}` : ""}
      </div>
      <div className="mb-2 rounded border border-white/10 p-2 text-[11px] text-slate-200">
        <div>Session: {cpuSession.sessionId}</div>
        <div>
          CPU decisions: {summary?.totalDecisions ?? 0} / fold {totals.folds ?? 0} /
          raise {totals.raises ?? 0} / call {totals.calls ?? 0}
        </div>
        <div>Sources: {Object.keys(totals.decisionSources ?? {}).join(", ") || "none"}</div>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          className="rounded bg-amber-400 px-3 py-2 font-semibold text-slate-950"
          onClick={handleExport}
        >
          Export Freeze Report
        </button>
        <button
          type="button"
          className="rounded bg-sky-500 px-3 py-2 font-semibold text-white"
          onClick={handleRecover}
        >
          Recover / Refresh Snapshot
        </button>
        <button
          type="button"
          className="rounded bg-emerald-500 px-3 py-2 font-semibold text-white"
          onClick={handleCpuExport}
        >
          Export CPU Session
        </button>
        <button
          type="button"
          className="rounded border border-white/25 px-3 py-2 font-semibold text-white"
          onClick={refreshCpuSession}
        >
          Refresh CPU Summary
        </button>
        <button
          type="button"
          className="rounded border border-white/25 px-3 py-2 font-semibold text-white"
          onClick={onReturnToMenu}
        >
          Return to Menu
        </button>
      </div>
        </>
      )}
    </div>
  );
}
