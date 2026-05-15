import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP34_EXPORTABILITY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-exportability-step34.json",
);
export const DEFAULT_STEP34_STABILITY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-stability-step34.json",
);
export const DEFAULT_STEP34_CROSS_DEPTH_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-cross-depth-consistency-step34.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function depthFailures(row = {}) {
  const failures = [];
  if (Number(row.sample ?? 0) < 20) failures.push("sampleCount<20");
  if (Number(row.invalid ?? 0) !== 0) failures.push("invalidReplayCount>0");
  if (Number(row.repairRate ?? 0) > 0.1) failures.push("repairRate>0.10");
  if (Number(row.signFlipRate ?? 0) > 0.1) failures.push("signFlipRate>0.10");
  if (Number(row.confidence ?? 0) < 0.8) failures.push("confidence<0.80");
  if (Number(row.meanDelta ?? 0) <= 0) failures.push("meanDelta<=0");
  return failures;
}

function classifyDecision({ rows = [], crossDepthConsistency = "NO_SIGNAL" } = {}) {
  if (crossDepthConsistency === "INCONSISTENT") return "DO_NOT_EXPORT";
  if (!rows.length || rows.some((row) => row.verdict === "NO_REPLAY_SIGNAL")) return "MONITOR_ONLY";
  const failures = rows.flatMap(depthFailures);
  if (!failures.length) return "EXPORTABLE_CANDIDATE";
  if (rows.some((row) => Number(row.valid ?? 0) > 0)) return "COUNTERFACTUAL_ONLY";
  return "DO_NOT_EXPORT";
}

export function decideS02StackDepthExportability({ stabilityReport = {}, consistencyReport = {} } = {}) {
  const rows = stabilityReport.rows ?? [];
  const depthDecisions = rows.map((row) => ({
    stackDepth: row.stackDepth,
    verdict: row.verdict,
    exportable: depthFailures(row).length === 0,
    failures: depthFailures(row),
  }));
  const decision = classifyDecision({ rows, crossDepthConsistency: consistencyReport.consistency });
  return {
    generatedAt: new Date().toISOString(),
    candidate: "S02 coverage-shadow stackDepth",
    decision,
    reason: [
      ...new Set([
        ...(consistencyReport.consistency === "INCONSISTENT" ? ["cross-depth-inconsistent"] : []),
        ...depthDecisions.flatMap((entry) => entry.failures),
        ...(depthDecisions.some((entry) => entry.verdict === "NO_REPLAY_SIGNAL") ? ["missing-engine-backed-depth"] : []),
      ]),
    ],
    crossDepthConsistency: consistencyReport.consistency ?? "NO_SIGNAL",
    depthDecisions,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP34_EXPORTABILITY_OUTPUT_PATH,
  };
}

export async function writeS02StackDepthExportability({
  stabilityPath = DEFAULT_STEP34_STABILITY_INPUT_PATH,
  consistencyPath = DEFAULT_STEP34_CROSS_DEPTH_INPUT_PATH,
  outputPath = DEFAULT_STEP34_EXPORTABILITY_OUTPUT_PATH,
  stabilityReport,
  consistencyReport,
} = {}) {
  const stability = stabilityReport ?? (await readJsonIfExists(stabilityPath));
  const consistency = consistencyReport ?? (await readJsonIfExists(consistencyPath));
  return writeJsonReport(outputPath, decideS02StackDepthExportability({ stabilityReport: stability, consistencyReport: consistency }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02StackDepthExportability();
  console.log(JSON.stringify(report, null, 2));
}
