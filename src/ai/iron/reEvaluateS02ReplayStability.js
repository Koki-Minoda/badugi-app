import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP35_STABILITY_REEVAL_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-replay-stability-reeval-step35.json",
);
export const DEFAULT_STEP35_FORCED_REPLAY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-forced-replay-step35.json",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function classify(row = {}) {
  if (Number(row.sampleCount ?? 0) === 0 || row.missingEngineBackedSamples) return "NO_SIGNAL";
  if (Number(row.invalidReplays ?? 0) > 0) return "VOLATILE";
  if (
    Number(row.sampleCount ?? 0) >= 30 &&
    Number(row.signFlipRate ?? 0) <= 0.1 &&
    Number(row.confidence ?? 0) >= 0.8 &&
    Number(row.repairRate ?? 0) <= 0.1 &&
    Number(row.meanDelta ?? 0) > 0
  ) {
    return "STABLE";
  }
  if (Number(row.meanDelta ?? 0) > 0 && Number(row.signFlipRate ?? 0) <= 0.2) return "UNDERPOWERED";
  return "VOLATILE";
}

export function reEvaluateS02ReplayStability({
  forcedReplayReport = {},
  outputPath = DEFAULT_STEP35_STABILITY_REEVAL_OUTPUT_PATH,
} = {}) {
  const rows = (forcedReplayReport.depths ?? []).map((depth) => ({
    depth: depth.stackDepth,
    sampleCount: Number(depth.sampleCount ?? 0),
    validReplayCount: Number(depth.validReplays ?? 0),
    invalidReplayCount: Number(depth.invalidReplays ?? 0),
    meanDelta: Number(depth.meanDelta ?? 0),
    medianDelta: Number(depth.medianDelta ?? 0),
    signFlipRate: Number(depth.signFlipRate ?? 0),
    confidence: Number(depth.confidence ?? 0),
    repairRate: Number(depth.repairRate ?? 0),
    deterministicReplay: Boolean(depth.deterministicReplay ?? false),
    verdict: classify(depth),
  }));
  return {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    rows,
    stableCount: rows.filter((row) => row.verdict === "STABLE").length,
    underpoweredCount: rows.filter((row) => row.verdict === "UNDERPOWERED").length,
    volatileCount: rows.filter((row) => row.verdict === "VOLATILE").length,
    noSignalCount: rows.filter((row) => row.verdict === "NO_SIGNAL").length,
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

export async function writeS02ReplayStabilityReevaluation({
  forcedReplayPath = DEFAULT_STEP35_FORCED_REPLAY_INPUT_PATH,
  outputPath = DEFAULT_STEP35_STABILITY_REEVAL_OUTPUT_PATH,
  forcedReplayReport,
} = {}) {
  const report = forcedReplayReport ?? (await readJson(forcedReplayPath));
  return writeJsonReport(outputPath, reEvaluateS02ReplayStability({ forcedReplayReport: report, outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02ReplayStabilityReevaluation();
  console.log(JSON.stringify(report, null, 2));
}
