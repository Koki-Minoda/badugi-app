import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP54_REPEATED_LEAK_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step54-repeated-leak-preview.json",
);

function recommendationFor(tag) {
  if (tag === "missed-value") return "強い手でチェックしすぎる場面を見直しましょう";
  return "繰り返し出ている判断パターンをリプレイで確認しましょう";
}

export function detectRepeatedCoachingLeaksSummary({ entries = [] } = {}) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = `${entry.lessonTag}|${entry.variantId}|${entry.actionFamily}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  const repeatedLeaks = [...groups.entries()]
    .map(([key, rows]) => {
      const [lessonTag, variantId, actionFamily] = key.split("|");
      return {
        leakTag: lessonTag,
        variantId,
        actionFamily,
        count: rows.length,
        estimatedEVReviewed: roundNumber(rows.reduce((sum, row) => sum + Number(row.evDelta ?? 0), 0), 4),
        lessonIds: rows.map((row) => row.lessonId).sort(),
        recommendation: recommendationFor(lessonTag),
      };
    })
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count || b.estimatedEVReviewed - a.estimatedEVReviewed || a.leakTag.localeCompare(b.leakTag));

  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    repeatedLeakCount: repeatedLeaks.length,
    repeatedLeaks,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function detectRepeatedCoachingLeaks({
  historyPath = path.resolve("reports/ai-iron/step54-coaching-history-store.json"),
  outputPath = DEFAULT_STEP54_REPEATED_LEAK_OUTPUT_PATH,
  entries = null,
} = {}) {
  const history = entries ? { entries } : await readJson(historyPath);
  const report = detectRepeatedCoachingLeaksSummary({ entries: history.entries ?? [] });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await detectRepeatedCoachingLeaks();
  console.log(JSON.stringify(report, null, 2));
}
