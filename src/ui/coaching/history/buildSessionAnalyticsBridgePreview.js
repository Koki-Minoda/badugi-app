import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP54_SESSION_BRIDGE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step54-session-analytics-bridge-preview.json",
);

export function buildSessionAnalyticsBridgePreviewSummary({ entries = [] } = {}) {
  const bySession = new Map();
  entries.forEach((entry) => {
    if (!bySession.has(entry.sessionId)) bySession.set(entry.sessionId, []);
    bySession.get(entry.sessionId).push(entry);
  });
  const sessions = [...bySession.entries()]
    .map(([sessionId, rows]) => ({
      sessionId,
      gameMode: rows[0]?.source === "cash-preview" ? "cash-preview" : "tournament",
      variantId: rows[0]?.variantId ?? null,
      handsPlayed: null,
      actualDeltaPreview: 0,
      evDeltaReviewed: roundNumber(rows.reduce((sum, row) => sum + Number(row.evDelta ?? 0), 0), 4),
      lessonCount: rows.length,
      helpfulCount: rows.filter((row) => row.helpfulState === "helpful").length,
      replayViewedCount: rows.filter((row) => row.replayViewed).length,
    }))
    .sort((a, b) => String(a.sessionId).localeCompare(String(b.sessionId)));
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    bridgeOnly: true,
    cashGraphImplemented: false,
    sessionCount: sessions.length,
    sessions,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildSessionAnalyticsBridgePreview({
  historyPath = path.resolve("reports/ai-iron/step54-coaching-history-store.json"),
  outputPath = DEFAULT_STEP54_SESSION_BRIDGE_OUTPUT_PATH,
  entries = null,
} = {}) {
  const history = entries ? { entries } : await readJson(historyPath);
  const report = buildSessionAnalyticsBridgePreviewSummary({ entries: history.entries ?? [] });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildSessionAnalyticsBridgePreview();
  console.log(JSON.stringify(report, null, 2));
}
