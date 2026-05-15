import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP34_STACK_DEPTH_STABILITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-stability-step34.json",
);
export const DEFAULT_STEP34_FORCED_REPLAY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-forced-replay-step34.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function classifyDepth(depth = {}) {
  if (depth.missingEngineBackedSamples || Number(depth.sampleCount ?? 0) === 0) return "NO_REPLAY_SIGNAL";
  if (Number(depth.invalidReplays ?? 0) > 0) return "COUNTERFACTUAL_ONLY";
  if (
    Number(depth.sampleCount ?? 0) >= 20 &&
    Number(depth.signFlipRate ?? 0) <= 0.1 &&
    Number(depth.confidence ?? 0) >= 0.8 &&
    Number(depth.repairRate ?? 0) <= 0.1 &&
    Number(depth.meanDelta ?? 0) > 0
  ) {
    return "STABLE_POSITIVE";
  }
  if (Number(depth.meanDelta ?? 0) > 0 && Number(depth.signFlipRate ?? 0) <= 0.2) return "POSITIVE_UNDERPOWERED";
  if (Number(depth.meanDelta ?? 0) <= 0) return "NEGATIVE_OR_FLAT";
  return "VOLATILE";
}

export function auditS02StackDepthStability({ forcedReplayReport = {} } = {}) {
  const rows = (forcedReplayReport.depths ?? []).map((depth) => ({
    stackDepth: depth.stackDepth,
    sample: Number(depth.sampleCount ?? 0),
    valid: Number(depth.validReplays ?? 0),
    invalid: Number(depth.invalidReplays ?? 0),
    meanDelta: Number(depth.meanDelta ?? 0),
    medianDelta: Number(depth.medianDelta ?? 0),
    signFlipRate: Number(depth.signFlipRate ?? 0),
    confidence: Number(depth.confidence ?? 0),
    repairRate: Number(depth.repairRate ?? 0),
    verdict: classifyDepth(depth),
  }));
  return {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    rows,
    stablePositiveCount: rows.filter((row) => row.verdict === "STABLE_POSITIVE").length,
    noReplaySignalCount: rows.filter((row) => row.verdict === "NO_REPLAY_SIGNAL").length,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP34_STACK_DEPTH_STABILITY_OUTPUT_PATH,
  };
}

export async function writeS02StackDepthStabilityAudit({
  forcedReplayPath = DEFAULT_STEP34_FORCED_REPLAY_INPUT_PATH,
  outputPath = DEFAULT_STEP34_STACK_DEPTH_STABILITY_OUTPUT_PATH,
  forcedReplayReport,
} = {}) {
  const report = forcedReplayReport ?? (await readJsonIfExists(forcedReplayPath));
  return writeJsonReport(outputPath, auditS02StackDepthStability({ forcedReplayReport: report }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02StackDepthStabilityAudit();
  console.log(JSON.stringify(report, null, 2));
}
