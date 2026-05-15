import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";
import { aggregateCoachingHistoryTelemetrySummary } from "./aggregateCoachingHistoryTelemetry.js";
import { detectRepeatedCoachingLeaksSummary } from "./detectRepeatedCoachingLeaks.js";
import { buildLessonRevisitLinksSummary } from "./buildLessonRevisitLinks.js";

export const DEFAULT_STEP54_RECAP_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step54-coaching-recap-viewmodel.json",
);

function countBy(entries = [], keyFn) {
  const map = new Map();
  entries.forEach((entry) => {
    const key = keyFn(entry);
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

export function buildCoachingRecapViewModelSummary({ entries = [], step53Summary = {} } = {}) {
  const telemetry = aggregateCoachingHistoryTelemetrySummary({ entries });
  const repeated = detectRepeatedCoachingLeaksSummary({ entries });
  const revisit = buildLessonRevisitLinksSummary({ entries });
  const tagCounts = countBy(entries, (entry) => entry.lessonTag ?? "unknown");
  const topLessonTag = tagCounts[0]?.[0] ?? null;
  const recentLessons = [...entries]
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)) || String(a.lessonId).localeCompare(String(b.lessonId)))
    .slice(0, 5);
  const estimatedTotalEVReviewed = roundNumber(entries.reduce((sum, entry) => sum + Number(entry.evDelta ?? 0), 0), 4);
  const primaryRecommendation =
    repeated.repeatedLeaks[0]?.recommendation ??
    step53Summary.primaryLesson?.titleJp ??
    "次のセッションでは、直近のリプレイを1つ見直しましょう";

  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    totalLessons: entries.length,
    uniqueLessonTags: new Set(entries.map((entry) => entry.lessonTag).filter(Boolean)).size,
    repeatedLeaks: repeated.repeatedLeaks,
    topLessonTag,
    replayRevisitCount: revisit.validCount,
    helpfulRate: telemetry.helpfulRate,
    estimatedTotalEVReviewed,
    recentLessons,
    primaryRecommendation,
    sections: {
      jp: {
        recent: "最近の学習",
        repeated: "よく出る課題",
        replay: "見直したリプレイ",
        helpful: "役に立ったレッスン",
        next: "次に意識すること",
      },
      en: {
        recent: "Recent learning",
        repeated: "Repeated leaks",
        replay: "Revisited replays",
        helpful: "Helpful lessons",
        next: "Next focus",
      },
    },
    telemetry,
    revisitLinks: revisit.links,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildCoachingRecapViewModel({
  historyPath = path.resolve("reports/ai-iron/step54-coaching-history-store.json"),
  step53SummaryPath = path.resolve("reports/ai-iron/step53-coaching-summary-viewmodel.json"),
  outputPath = DEFAULT_STEP54_RECAP_OUTPUT_PATH,
  entries = null,
  step53Summary = null,
} = {}) {
  const history = entries ? { entries } : await readJson(historyPath);
  const report = buildCoachingRecapViewModelSummary({
    entries: history.entries ?? [],
    step53Summary: step53Summary ?? (await readJson(step53SummaryPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildCoachingRecapViewModel();
  console.log(JSON.stringify(report, null, 2));
}
