import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP37_AGGREGATE_STABILITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-aggregate-stability-step37.json",
);
export const DEFAULT_STEP37_PLAYERCOUNT_FORCED_REPLAY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-playercount-forced-replay-step37.json",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function classify(aggregate = {}) {
  if (Number(aggregate.invalidReplayCount ?? 0) > 0) return "VOLATILE";
  if (
    Number(aggregate.sampleCount ?? 0) >= 100 &&
    Number(aggregate.signFlipRate ?? 0) <= 0.1 &&
    Number(aggregate.confidence ?? 0) >= 0.8 &&
    Number(aggregate.meanDelta ?? 0) > 0
  ) {
    return "STABLE";
  }
  if (Number(aggregate.meanDelta ?? 0) > 0 && Number(aggregate.signFlipRate ?? 0) <= 0.1) return "PARTIAL";
  return "VOLATILE";
}

export function recheckS02DeepAggregateStability({
  forcedReplayReport = {},
  outputPath = DEFAULT_STEP37_AGGREGATE_STABILITY_OUTPUT_PATH,
} = {}) {
  const aggregate = forcedReplayReport.aggregate ?? {};
  const report = {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    target: "deep RAISE vs CHECK aggregate after playerCount expansion",
    sample: Number(aggregate.sampleCount ?? 0),
    validReplayCount: Number(aggregate.validReplayCount ?? 0),
    invalidReplayCount: Number(aggregate.invalidReplayCount ?? 0),
    meanDelta: Number(aggregate.meanDelta ?? 0),
    medianDelta: Number(aggregate.medianDelta ?? 0),
    signFlip: Number(aggregate.signFlipRate ?? 0),
    confidence: Number(aggregate.confidence ?? 0),
    repairRate: Number(aggregate.repairRate ?? 0),
    deterministicReplay: Boolean(aggregate.deterministicReplay),
    verdict: classify(aggregate),
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath,
  };
  return report;
}

export async function writeS02DeepAggregateStabilityRecheck({
  forcedReplayPath = DEFAULT_STEP37_PLAYERCOUNT_FORCED_REPLAY_INPUT_PATH,
  outputPath = DEFAULT_STEP37_AGGREGATE_STABILITY_OUTPUT_PATH,
  forcedReplayReport,
} = {}) {
  const report = forcedReplayReport ?? (await readJson(forcedReplayPath));
  return writeJsonReport(outputPath, recheckS02DeepAggregateStability({ forcedReplayReport: report, outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02DeepAggregateStabilityRecheck();
  console.log(JSON.stringify(report, null, 2));
}
