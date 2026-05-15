import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP56_REPLAY_REVISIT_QUEUE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step56-replay-revisit-queue.json",
);

function repeatedKeySet(recap = {}) {
  return new Set((recap.repeatedLeaks ?? []).map((leak) => `${leak.variantId}|${leak.leakTag}|${leak.actionFamily}`));
}

export function buildReplayRevisitQueueSummary({ history = {}, recap = {} } = {}) {
  const repeated = repeatedKeySet(recap);
  const items = (history.entries ?? [])
    .filter((entry) => entry.replayDeterministic && entry.replayRef && entry.replayUrl)
    .map((entry) => {
      const repeatedLeak = repeated.has(`${entry.variantId}|${entry.lessonTag}|${entry.actionFamily}`);
      const score = roundNumber(Number(entry.evDelta ?? 0) + (entry.helpfulState === "helpful" ? 10 : 0) + (repeatedLeak ? 15 : 0), 4);
      return {
        lessonId: entry.lessonId,
        variantId: entry.variantId,
        lessonTag: entry.lessonTag,
        replayRef: entry.replayRef,
        href: entry.replayUrl,
        deterministic: true,
        evDelta: Number(entry.evDelta ?? 0),
        repeatedLeak,
        helpfulState: entry.helpfulState,
        replayViewed: entry.replayViewed === true,
        priorityScore: score,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || String(a.lessonId).localeCompare(String(b.lessonId)));
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    queueCount: items.length,
    items,
    emptyStateSafe: items.length === 0,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildReplayRevisitQueue({
  historyPath = path.resolve("reports/ai-iron/step55-variant-aware-history.json"),
  recapPath = path.resolve("reports/ai-iron/step55-multi-tournament-recap.json"),
  outputPath = DEFAULT_STEP56_REPLAY_REVISIT_QUEUE_OUTPUT_PATH,
  history = null,
  recap = null,
} = {}) {
  const report = buildReplayRevisitQueueSummary({
    history: history ?? (await readJson(historyPath)),
    recap: recap ?? (await readJson(recapPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildReplayRevisitQueue();
  console.log(JSON.stringify(report, null, 2));
}
