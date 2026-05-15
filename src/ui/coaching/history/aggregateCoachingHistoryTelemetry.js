import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";
import { detectRepeatedCoachingLeaksSummary } from "./detectRepeatedCoachingLeaks.js";

export const DEFAULT_STEP54_HISTORY_TELEMETRY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step54-history-telemetry-summary.json",
);

export function aggregateCoachingHistoryTelemetrySummary({ entries = [] } = {}) {
  const repeated = detectRepeatedCoachingLeaksSummary({ entries });
  const lessonsAcknowledged = entries.filter((entry) => entry.acknowledged).length;
  const helpful = entries.filter((entry) => entry.helpfulState === "helpful").length;
  const notHelpful = entries.filter((entry) => entry.helpfulState === "not-helpful").length;
  const replayViewed = entries.filter((entry) => entry.replayViewed).length;
  const sessions = new Set(entries.map((entry) => entry.sessionId).filter(Boolean));
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    lessonsShown: entries.length,
    lessonsAcknowledged,
    helpfulRate: roundNumber(helpful + notHelpful > 0 ? helpful / (helpful + notHelpful) : 0, 4),
    replayOpenRate: roundNumber(entries.length > 0 ? replayViewed / entries.length : 0, 4),
    revisitRate: roundNumber(entries.length > 0 ? replayViewed / entries.length : 0, 4),
    repeatedLeakCount: repeated.repeatedLeakCount,
    sessionCount: sessions.size,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function aggregateCoachingHistoryTelemetry({
  historyPath = path.resolve("reports/ai-iron/step54-coaching-history-store.json"),
  outputPath = DEFAULT_STEP54_HISTORY_TELEMETRY_OUTPUT_PATH,
  entries = null,
} = {}) {
  const history = entries ? { entries } : await readJson(historyPath);
  const report = aggregateCoachingHistoryTelemetrySummary({ entries: history.entries ?? [] });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await aggregateCoachingHistoryTelemetry();
  console.log(JSON.stringify(report, null, 2));
}
