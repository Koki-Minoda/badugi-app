import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP35_DEEP_EXPANSION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-confidence-expansion-step35.json",
);
export const DEFAULT_STEP34_FORCED_REPLAY_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-forced-replay-step34.json",
);
export const DEFAULT_STEP35_FORCED_REPLAY_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-forced-replay-step35.json",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function depthSummary(report = {}, depthName = "deep") {
  return (report.depths ?? []).find((depth) => depth.stackDepth === depthName) ?? {};
}

export function expandS02DeepReplaySamples({
  beforeReport = {},
  afterReport = {},
  outputPath = DEFAULT_STEP35_DEEP_EXPANSION_OUTPUT_PATH,
} = {}) {
  const before = depthSummary(beforeReport, "deep");
  const after = depthSummary(afterReport, "deep");
  return {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    depth: "deep",
    sampleBefore: Number(before.sampleCount ?? 0),
    sampleAfter: Number(after.sampleCount ?? 0),
    validBefore: Number(before.validReplays ?? 0),
    validAfter: Number(after.validReplays ?? 0),
    invalidReplayCount: Number(after.invalidReplays ?? 0),
    confidenceBefore: Number(before.confidence ?? 0),
    confidenceAfter: Number(after.confidence ?? 0),
    signFlipRate: Number(after.signFlipRate ?? 0),
    meanDeltaBefore: Number(before.meanDelta ?? 0),
    meanDeltaAfter: Number(after.meanDelta ?? 0),
    deterministicReplay: Boolean(after.deterministicReplay ?? false),
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath,
  };
}

export async function writeS02DeepReplaySampleExpansion({
  beforePath = DEFAULT_STEP34_FORCED_REPLAY_PATH,
  afterPath = DEFAULT_STEP35_FORCED_REPLAY_PATH,
  outputPath = DEFAULT_STEP35_DEEP_EXPANSION_OUTPUT_PATH,
  beforeReport,
  afterReport,
} = {}) {
  const before = beforeReport ?? (await readJson(beforePath));
  const after = afterReport ?? (await readJson(afterPath));
  return writeJsonReport(outputPath, expandS02DeepReplaySamples({ beforeReport: before, afterReport: after, outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02DeepReplaySampleExpansion();
  console.log(JSON.stringify(report, null, 2));
}
