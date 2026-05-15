import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP37_BRANCH_CONFIDENCE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-branch-confidence-step37.json",
);
export const DEFAULT_STEP37_PLAYERCOUNT_FORCED_REPLAY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-playercount-forced-replay-step37.json",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function classifyBranch(branch = {}) {
  if (Number(branch.sampleCount ?? 0) === 0) return "NO_SIGNAL";
  if (Number(branch.invalidReplayCount ?? 0) !== 0) return "VOLATILE";
  if (Number(branch.signFlipRate ?? 0) > 0.1) return "VOLATILE";
  if (Number(branch.sampleCount ?? 0) >= 50 && Number(branch.confidence ?? 0) >= 0.8) return "CONFIDENT";
  return "UNDERPOWERED";
}

export function auditS02DeepBranchConfidence({
  forcedReplayReport = {},
  outputPath = DEFAULT_STEP37_BRANCH_CONFIDENCE_OUTPUT_PATH,
} = {}) {
  const branches = (forcedReplayReport.branches ?? []).map((branch) => ({
    playerCount: Number(branch.playerCount ?? 0),
    sampleCount: Number(branch.sampleCount ?? 0),
    validReplayCount: Number(branch.validReplayCount ?? 0),
    invalidReplayCount: Number(branch.invalidReplayCount ?? 0),
    meanDelta: Number(branch.meanDelta ?? 0),
    medianDelta: Number(branch.medianDelta ?? 0),
    signFlipRate: Number(branch.signFlipRate ?? 0),
    confidence: Number(branch.confidence ?? 0),
    repairRate: Number(branch.repairRate ?? 0),
    deterministicReplay: Boolean(branch.deterministicReplay),
    verdict: classifyBranch(branch),
  }));
  return {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    target: "deep RAISE vs CHECK playerCount branches",
    branches,
    confidentBranches: branches.filter((branch) => branch.verdict === "CONFIDENT").length,
    allConfident: branches.length > 0 && branches.every((branch) => branch.verdict === "CONFIDENT"),
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

export async function writeS02DeepBranchConfidenceAudit({
  forcedReplayPath = DEFAULT_STEP37_PLAYERCOUNT_FORCED_REPLAY_INPUT_PATH,
  outputPath = DEFAULT_STEP37_BRANCH_CONFIDENCE_OUTPUT_PATH,
  forcedReplayReport,
} = {}) {
  const report = forcedReplayReport ?? (await readJson(forcedReplayPath));
  return writeJsonReport(outputPath, auditS02DeepBranchConfidence({ forcedReplayReport: report, outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02DeepBranchConfidenceAudit();
  console.log(JSON.stringify(report, null, 2));
}
