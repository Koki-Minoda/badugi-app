import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP36_NARROW_CANDIDATES_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-narrow-candidates-step36.json",
);
export const DEFAULT_STEP36_ISOLATION_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-raisecheck-isolation-step36.json",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function classify(row = {}, entropyThreshold = 0.75) {
  if (Number(row.invalidReplayCount ?? 0) > 0) return "REJECT";
  if (
    Number(row.sampleCount ?? 0) >= 20 &&
    Number(row.signFlipRate ?? 0) <= 0.1 &&
    Number(row.confidence ?? 0) >= 0.8 &&
    Number(row.repairRate ?? 0) <= 0.1 &&
    Number(row.entropyScore ?? 0) <= entropyThreshold &&
    Number(row.meanDelta ?? 0) > 0
  ) {
    return "EXPORTABLE_CANDIDATE";
  }
  if (Number(row.sampleCount ?? 0) >= 20 && Number(row.signFlipRate ?? 0) <= 0.1 && Number(row.meanDelta ?? 0) > 0) {
    return "COUNTERFACTUAL_ONLY";
  }
  if (Number(row.sampleCount ?? 0) > 0) return "MONITOR_ONLY";
  return "REJECT";
}

export function scanS02DeepNarrowCandidates({
  isolationReport = {},
  entropyThreshold = 0.75,
  outputPath = DEFAULT_STEP36_NARROW_CANDIDATES_OUTPUT_PATH,
} = {}) {
  const candidates = (isolationReport.rows ?? []).map((row) => ({
    candidate: row.bucket,
    axis: row.axis,
    sample: Number(row.sampleCount ?? 0),
    meanDelta: Number(row.meanDelta ?? 0),
    signFlipRate: Number(row.signFlipRate ?? 0),
    confidence: Number(row.confidence ?? 0),
    repairRate: Number(row.repairRate ?? 0),
    entropy: Number(row.entropyScore ?? 0),
    invalidReplayCount: Number(row.invalidReplayCount ?? 0),
    verdict: classify(row, entropyThreshold),
  }));
  candidates.sort((left, right) => {
    const rank = { EXPORTABLE_CANDIDATE: 0, COUNTERFACTUAL_ONLY: 1, MONITOR_ONLY: 2, REJECT: 3 };
    return (rank[left.verdict] ?? 9) - (rank[right.verdict] ?? 9) || right.sample - left.sample || left.candidate.localeCompare(right.candidate);
  });
  return {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    target: "deep RAISE vs CHECK",
    entropyThreshold,
    candidates,
    exportableCount: candidates.filter((candidate) => candidate.verdict === "EXPORTABLE_CANDIDATE").length,
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

export async function writeS02DeepNarrowCandidateScan({
  isolationPath = DEFAULT_STEP36_ISOLATION_INPUT_PATH,
  outputPath = DEFAULT_STEP36_NARROW_CANDIDATES_OUTPUT_PATH,
  isolationReport,
  entropyThreshold = 0.75,
} = {}) {
  const report = isolationReport ?? (await readJson(isolationPath));
  return writeJsonReport(outputPath, scanS02DeepNarrowCandidates({ isolationReport: report, entropyThreshold, outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02DeepNarrowCandidateScan();
  console.log(JSON.stringify(report, null, 2));
}
