import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP37_EXPORT_GOVERNANCE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-export-governance-step37.json",
);
export const DEFAULT_STEP37_BRANCH_CONFIDENCE_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-branch-confidence-step37.json",
);
export const DEFAULT_STEP37_AGGREGATE_STABILITY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-aggregate-stability-step37.json",
);
export const DEFAULT_STEP37_PLAYERCOUNT_FORCED_REPLAY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-playercount-forced-replay-step37.json",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function branchDirection(branch = {}) {
  if (Number(branch.meanDelta ?? 0) > 0) return "POSITIVE";
  if (Number(branch.meanDelta ?? 0) < 0) return "NEGATIVE";
  return "FLAT";
}

function crossBucketConsistency(branches = []) {
  const directions = new Set(branches.map(branchDirection));
  if (directions.size === 1 && directions.has("POSITIVE")) return "CONSISTENT";
  if (directions.has("POSITIVE")) return "PARTIAL";
  return "INCONSISTENT";
}

function decide({ branchReport = {}, aggregateReport = {}, forcedReplayReport = {} } = {}) {
  const branches = branchReport.branches ?? [];
  const consistency = crossBucketConsistency(branches);
  if (branches.some((branch) => Number(branch.invalidReplayCount ?? 0) > 0)) return "COUNTERFACTUAL_ONLY";
  if (consistency === "INCONSISTENT") return "DO_NOT_EXPORT";
  if (
    branchReport.allConfident &&
    aggregateReport.verdict === "STABLE" &&
    consistency === "CONSISTENT" &&
    Number(forcedReplayReport.invalidReplayCount ?? 0) === 0 &&
    forcedReplayReport.deterministicReplay === true
  ) {
    return "SAFE_TO_EXPORT_NEXT";
  }
  if (branches.some((branch) => branch.verdict === "CONFIDENT")) return "COUNTERFACTUAL_ONLY";
  return "MONITOR_ONLY";
}

export function redecideS02DeepExportGovernance({
  branchReport = {},
  aggregateReport = {},
  forcedReplayReport = {},
  outputPath = DEFAULT_STEP37_EXPORT_GOVERNANCE_OUTPUT_PATH,
} = {}) {
  const branches = branchReport.branches ?? [];
  const consistency = crossBucketConsistency(branches);
  const decision = decide({ branchReport, aggregateReport, forcedReplayReport });
  return {
    generatedAt: new Date().toISOString(),
    candidate: "S02 deep RAISE vs CHECK playerCount isolated",
    decision,
    branchConfidence: Object.fromEntries(branches.map((branch) => [String(branch.playerCount), branch.verdict])),
    aggregateStability: aggregateReport.verdict ?? "UNKNOWN",
    crossBucketConsistency: consistency,
    deterministicReplay: Boolean(forcedReplayReport.deterministicReplay),
    invalidReplayCount: Number(forcedReplayReport.invalidReplayCount ?? 0),
    reason: [
      ...(branchReport.allConfident ? [] : ["branch-confidence-under-threshold"]),
      ...(aggregateReport.verdict === "STABLE" ? [] : ["aggregate-not-stable"]),
      ...(consistency === "CONSISTENT" ? [] : ["cross-bucket-not-consistent"]),
      ...(forcedReplayReport.deterministicReplay === true ? [] : ["determinism-not-confirmed"]),
      ...(Number(forcedReplayReport.invalidReplayCount ?? 0) === 0 ? [] : ["invalid-replay"]),
    ],
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

export async function writeS02DeepExportGovernanceRedecision({
  branchPath = DEFAULT_STEP37_BRANCH_CONFIDENCE_INPUT_PATH,
  aggregatePath = DEFAULT_STEP37_AGGREGATE_STABILITY_INPUT_PATH,
  forcedReplayPath = DEFAULT_STEP37_PLAYERCOUNT_FORCED_REPLAY_INPUT_PATH,
  outputPath = DEFAULT_STEP37_EXPORT_GOVERNANCE_OUTPUT_PATH,
  branchReport,
  aggregateReport,
  forcedReplayReport,
} = {}) {
  const branches = branchReport ?? (await readJson(branchPath));
  const aggregate = aggregateReport ?? (await readJson(aggregatePath));
  const replay = forcedReplayReport ?? (await readJson(forcedReplayPath));
  return writeJsonReport(
    outputPath,
    redecideS02DeepExportGovernance({
      branchReport: branches,
      aggregateReport: aggregate,
      forcedReplayReport: replay,
      outputPath,
    }),
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02DeepExportGovernanceRedecision();
  console.log(JSON.stringify(report, null, 2));
}
