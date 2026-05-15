import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";
import { detectVariantRepeatedLeaksSummary } from "./detectVariantRepeatedLeaks.js";
import { normalizeCoachingHistoryEntry } from "./coachingHistoryStore.js";

export const DEFAULT_STEP55_VARIANT_TELEMETRY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step55-variant-aware-telemetry.json",
);

function emptyMetrics() {
  return {
    lessonsShown: 0,
    replayOpened: 0,
    replayCompleted: 0,
    lessonAcknowledged: 0,
    helpful: 0,
    notHelpful: 0,
    helpfulRate: 0,
    replayCompletionRate: 0,
    revisitRate: 0,
    repeatedLeakCount: 0,
  };
}

function finalizeMetrics(metrics, repeatedLeakCount = 0) {
  return {
    lessonsShown: metrics.lessonsShown,
    replayOpened: metrics.replayOpened,
    replayCompleted: metrics.replayCompleted,
    lessonAcknowledged: metrics.lessonAcknowledged,
    helpfulRate: roundNumber(metrics.helpful + metrics.notHelpful > 0 ? metrics.helpful / (metrics.helpful + metrics.notHelpful) : 0, 4),
    replayCompletionRate: roundNumber(metrics.replayOpened > 0 ? metrics.replayCompleted / metrics.replayOpened : 0, 4),
    revisitRate: roundNumber(metrics.lessonsShown > 0 ? metrics.replayCompleted / metrics.lessonsShown : 0, 4),
    repeatedLeakCount,
  };
}

function aggregateRows(rows = [], repeatedLeakCount = 0) {
  const metrics = rows.reduce((acc, row) => {
    acc.lessonsShown += 1;
    if (row.replayViewed) {
      acc.replayOpened += 1;
      acc.replayCompleted += 1;
    }
    if (row.acknowledged) acc.lessonAcknowledged += 1;
    if (row.helpfulState === "helpful") acc.helpful += 1;
    if (row.helpfulState === "not-helpful") acc.notHelpful += 1;
    return acc;
  }, emptyMetrics());
  return finalizeMetrics(metrics, repeatedLeakCount);
}

function groupBy(entries, keyFn) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = keyFn(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return groups;
}

function objectFromGroups(groups, repeatedLookup = new Map()) {
  return Object.fromEntries(
    [...groups.entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([key, rows]) => [key, aggregateRows(rows, repeatedLookup.get(key) ?? 0)]),
  );
}

export function aggregateVariantAwareCoachingTelemetrySummary({ entries = [] } = {}) {
  const normalized = entries.map(normalizeCoachingHistoryEntry);
  const repeated = detectVariantRepeatedLeaksSummary({ entries: normalized });
  const repeatedByVariant = new Map(
    Object.entries(repeated.byVariant ?? {}).map(([variantId, leaks]) => [variantId, leaks.length]),
  );
  const repeatedByVariantLessonTag = new Map();
  Object.entries(repeated.byVariant ?? {}).forEach(([variantId, leaks]) => {
    leaks.forEach((leak) => repeatedByVariantLessonTag.set(`${variantId}|${leak.leakTag}`, 1));
  });

  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    global: aggregateRows(normalized, repeated.global.repeatedLeakCount),
    byVariant: objectFromGroups(groupBy(normalized, (entry) => entry.variantId), repeatedByVariant),
    byLessonTag: objectFromGroups(groupBy(normalized, (entry) => entry.lessonTag ?? "unknown")),
    byVariantLessonTag: objectFromGroups(
      groupBy(normalized, (entry) => `${entry.variantId}|${entry.lessonTag ?? "unknown"}`),
      repeatedByVariantLessonTag,
    ),
    bySessionVariant: objectFromGroups(groupBy(normalized, (entry) => `${entry.sessionId}|${entry.variantId}`)),
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function aggregateVariantAwareCoachingTelemetry({
  historyPath = path.resolve("reports/ai-iron/step55-variant-aware-history.json"),
  outputPath = DEFAULT_STEP55_VARIANT_TELEMETRY_OUTPUT_PATH,
  entries = null,
} = {}) {
  const history = entries ? { entries } : await readJson(historyPath);
  const report = aggregateVariantAwareCoachingTelemetrySummary({ entries: history.entries ?? [] });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await aggregateVariantAwareCoachingTelemetry();
  console.log(JSON.stringify(report, null, 2));
}
