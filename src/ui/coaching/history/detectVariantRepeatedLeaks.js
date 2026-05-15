import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";
import { normalizeCoachingHistoryEntry } from "./coachingHistoryStore.js";

export const DEFAULT_STEP55_VARIANT_REPEATED_LEAKS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step55-variant-repeated-leaks.json",
);

function recommendationFor({ variantId, tag }) {
  if (tag === "missed-value") {
    return `${variantId}では強い手でチェックしすぎる場面を見直しましょう`;
  }
  if (tag === "second-pressure") {
    return `${variantId}では二度目の圧力に対する返し方をリプレイで確認しましょう`;
  }
  return `${variantId}で繰り返し出ている判断パターンを確認しましょう`;
}

function buildLeaks(rows = []) {
  const groups = new Map();
  rows.forEach((entry) => {
    const key = `${entry.lessonTag ?? "unknown"}|${entry.actionFamily ?? "unknown"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return [...groups.entries()]
    .map(([key, groupedRows]) => {
      const [leakTag, actionFamily] = key.split("|");
      const variantId = groupedRows[0]?.variantId ?? "unknownVariant";
      return {
        variantId,
        leakTag,
        actionFamily,
        count: groupedRows.length,
        estimatedEVReviewed: roundNumber(groupedRows.reduce((sum, row) => sum + Number(row.evDelta ?? 0), 0), 4),
        lessonIds: groupedRows.map((row) => row.lessonId).sort(),
        recommendation: recommendationFor({ variantId, tag: leakTag }),
      };
    })
    .filter((leak) => leak.count >= 2)
    .sort((a, b) => b.count - a.count || b.estimatedEVReviewed - a.estimatedEVReviewed || a.variantId.localeCompare(b.variantId));
}

export function detectVariantRepeatedLeaksSummary({ entries = [] } = {}) {
  const normalized = entries.map(normalizeCoachingHistoryEntry);
  const variants = [...new Set(normalized.map((entry) => entry.variantId))].sort();
  const byVariant = Object.fromEntries(
    variants.map((variantId) => [variantId, buildLeaks(normalized.filter((entry) => entry.variantId === variantId))]),
  );
  const crossVariantGroups = new Map();
  normalized.forEach((entry) => {
    const key = `${entry.lessonTag ?? "unknown"}|${entry.actionFamily ?? "unknown"}`;
    if (!crossVariantGroups.has(key)) crossVariantGroups.set(key, []);
    crossVariantGroups.get(key).push(entry);
  });
  const secondaryInsights = [...crossVariantGroups.entries()]
    .map(([key, rows]) => {
      const [leakTag, actionFamily] = key.split("|");
      return {
        scope: "global-secondary",
        leakTag,
        actionFamily,
        variants: [...new Set(rows.map((row) => row.variantId))].sort(),
        count: rows.length,
        estimatedEVReviewed: roundNumber(rows.reduce((sum, row) => sum + Number(row.evDelta ?? 0), 0), 4),
      };
    })
    .filter((insight) => insight.count >= 2)
    .sort((a, b) => b.estimatedEVReviewed - a.estimatedEVReviewed || a.leakTag.localeCompare(b.leakTag));
  const repeatedLeakCount = Object.values(byVariant).reduce((sum, leaks) => sum + leaks.length, 0);

  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    global: {
      repeatedLeakCount,
      secondaryInsights,
    },
    byVariant,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function detectVariantRepeatedLeaks({
  historyPath = path.resolve("reports/ai-iron/step55-variant-aware-history.json"),
  outputPath = DEFAULT_STEP55_VARIANT_REPEATED_LEAKS_OUTPUT_PATH,
  entries = null,
} = {}) {
  const history = entries ? { entries } : await readJson(historyPath);
  const report = detectVariantRepeatedLeaksSummary({ entries: history.entries ?? [] });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await detectVariantRepeatedLeaks();
  console.log(JSON.stringify(report, null, 2));
}
