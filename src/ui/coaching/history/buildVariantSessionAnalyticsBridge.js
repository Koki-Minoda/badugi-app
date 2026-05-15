import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";
import { normalizeCoachingHistoryEntry } from "./coachingHistoryStore.js";

export const DEFAULT_STEP55_VARIANT_SESSION_BRIDGE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step55-variant-session-analytics-bridge.json",
);

function groupBy(entries, keyFn) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = keyFn(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return groups;
}

function summarizeRows(rows = [], extra = {}) {
  return {
    ...extra,
    gameMode: rows[0]?.source === "cash-preview" ? "cash-preview" : "tournament",
    variantId: extra.variantId ?? rows[0]?.variantId ?? "mixed",
    handsPlayed: null,
    actualDeltaPreview: 0,
    evDeltaReviewed: roundNumber(rows.reduce((sum, row) => sum + Number(row.evDelta ?? 0), 0), 4),
    lessonCount: rows.length,
    helpfulCount: rows.filter((row) => row.helpfulState === "helpful").length,
    replayViewedCount: rows.filter((row) => row.replayViewed).length,
  };
}

function objectFromGroups(groups, mapper) {
  return Object.fromEntries([...groups.entries()].sort(([a], [b]) => String(a).localeCompare(String(b))).map(mapper));
}

export function buildVariantSessionAnalyticsBridgeSummary({ entries = [] } = {}) {
  const normalized = entries.map(normalizeCoachingHistoryEntry);
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    bridgeOnly: true,
    cashGraphImplemented: false,
    global: summarizeRows(normalized, { scope: "global", variantId: "mixed" }),
    byVariant: objectFromGroups(groupBy(normalized, (entry) => entry.variantId), ([variantId, rows]) => [
      variantId,
      summarizeRows(rows, { scope: "variant", variantId }),
    ]),
    bySession: objectFromGroups(groupBy(normalized, (entry) => entry.sessionId), ([sessionId, rows]) => [
      sessionId,
      summarizeRows(rows, { scope: "session", sessionId, variantId: "mixed" }),
    ]),
    bySessionVariant: objectFromGroups(groupBy(normalized, (entry) => `${entry.sessionId}|${entry.variantId}`), ([key, rows]) => {
      const [sessionId, variantId] = key.split("|");
      return [key, summarizeRows(rows, { scope: "session-variant", sessionId, variantId })];
    }),
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildVariantSessionAnalyticsBridge({
  historyPath = path.resolve("reports/ai-iron/step55-variant-aware-history.json"),
  outputPath = DEFAULT_STEP55_VARIANT_SESSION_BRIDGE_OUTPUT_PATH,
  entries = null,
} = {}) {
  const history = entries ? { entries } : await readJson(historyPath);
  const report = buildVariantSessionAnalyticsBridgeSummary({ entries: history.entries ?? [] });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildVariantSessionAnalyticsBridge();
  console.log(JSON.stringify(report, null, 2));
}
