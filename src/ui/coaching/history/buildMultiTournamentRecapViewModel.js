import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";
import { aggregateVariantAwareCoachingTelemetrySummary } from "./aggregateVariantAwareCoachingTelemetry.js";
import { buildLessonRevisitLinksSummary } from "./buildLessonRevisitLinks.js";
import { normalizeCoachingHistoryEntry, sortCoachingHistoryEntries } from "./coachingHistoryStore.js";
import { detectVariantRepeatedLeaksSummary } from "./detectVariantRepeatedLeaks.js";
import { buildFriendFacingTrendCopySummary } from "./buildFriendFacingTrendCopy.js";

export const DEFAULT_STEP55_MULTI_TOURNAMENT_RECAP_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step55-multi-tournament-recap.json",
);

function countBy(rows, keyFn) {
  const counts = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

function summarizeRows(rows = []) {
  const tagCounts = countBy(rows, (row) => row.lessonTag ?? "unknown");
  const helpful = rows.filter((row) => row.helpfulState === "helpful").length;
  const helpfulDenominator = rows.filter((row) => row.helpfulState === "helpful" || row.helpfulState === "not-helpful").length;
  return {
    lessonCount: rows.length,
    topLeakTag: tagCounts[0]?.[0] ?? null,
    estimatedEVReviewed: roundNumber(rows.reduce((sum, row) => sum + Number(row.evDelta ?? 0), 0), 4),
    helpfulRate: roundNumber(helpfulDenominator > 0 ? helpful / helpfulDenominator : 0, 4),
    replayViewedCount: rows.filter((row) => row.replayViewed).length,
  };
}

function buildByGroup(entries, keyFn) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = keyFn(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return Object.fromEntries([...groups.entries()].sort(([a], [b]) => String(a).localeCompare(String(b))).map(([key, rows]) => [key, summarizeRows(rows)]));
}

export function buildMultiTournamentRecapViewModelSummary({ entries = [] } = {}) {
  const normalized = sortCoachingHistoryEntries(entries.map(normalizeCoachingHistoryEntry));
  const repeated = detectVariantRepeatedLeaksSummary({ entries: normalized });
  const telemetry = aggregateVariantAwareCoachingTelemetrySummary({ entries: normalized });
  const revisit = buildLessonRevisitLinksSummary({ entries: normalized });
  const byVariant = buildByGroup(normalized, (entry) => entry.variantId);
  Object.entries(byVariant).forEach(([variantId, summary]) => {
    summary.repeatedLeaks = repeated.byVariant[variantId] ?? [];
  });
  const global = {
    sessionCount: new Set(normalized.map((entry) => entry.sessionId)).size,
    totalLessons: normalized.length,
    topLeakTag: summarizeRows(normalized).topLeakTag,
    estimatedEVReviewed: summarizeRows(normalized).estimatedEVReviewed,
    helpfulRate: summarizeRows(normalized).helpfulRate,
  };
  const trendCopy = buildFriendFacingTrendCopySummary({ recap: { global, byVariant }, repeatedLeaks: repeated });
  const firstRepeated = Object.values(repeated.byVariant).flat()[0];
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    global,
    byTournament: buildByGroup(normalized, (entry) => entry.sessionId),
    byVariant,
    trendCopy,
    recommendedNextFocus: firstRepeated?.recommendation ?? "次のセッションでは、直近のリプレイを1つ見直しましょう",
    recentLessons: [...normalized].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 5),
    replayRevisitLinks: revisit.links,
    repeatedLeaks: Object.values(repeated.byVariant).flat(),
    telemetry,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildMultiTournamentRecapViewModel({
  historyPath = path.resolve("reports/ai-iron/step55-variant-aware-history.json"),
  outputPath = DEFAULT_STEP55_MULTI_TOURNAMENT_RECAP_OUTPUT_PATH,
  entries = null,
} = {}) {
  const history = entries ? { entries } : await readJson(historyPath);
  const report = buildMultiTournamentRecapViewModelSummary({ entries: history.entries ?? [] });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildMultiTournamentRecapViewModel();
  console.log(JSON.stringify(report, null, 2));
}
