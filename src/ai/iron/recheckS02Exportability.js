import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP35_EXPORTABILITY_RECHECK_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-exportability-recheck-step35.json",
);
export const DEFAULT_STEP35_STABILITY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-replay-stability-reeval-step35.json",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function failures(row = {}) {
  const list = [];
  if (Number(row.sampleCount ?? 0) < 30) list.push("sampleCount<30");
  if (Number(row.invalidReplayCount ?? 0) !== 0) list.push("invalidReplayCount>0");
  if (Number(row.repairRate ?? 0) > 0.1) list.push("repairRate>0.10");
  if (Number(row.signFlipRate ?? 0) > 0.1) list.push("signFlipRate>0.10");
  if (Number(row.confidence ?? 0) < 0.8) list.push("confidence<0.80");
  if (!row.deterministicReplay) list.push("deterministicReplay=false");
  if (Number(row.meanDelta ?? 0) <= 0) list.push("meanDelta<=0");
  return list;
}

function classify(rows = []) {
  if (rows.some((row) => row.verdict === "STABLE" && failures(row).length === 0)) return "EXPORTABLE_CANDIDATE";
  if (rows.some((row) => row.verdict === "VOLATILE")) return "COUNTERFACTUAL_ONLY";
  if (rows.some((row) => Number(row.validReplayCount ?? 0) > 0)) return "MONITOR_ONLY";
  return "DO_NOT_EXPORT";
}

export function recheckS02Exportability({
  stabilityReport = {},
  outputPath = DEFAULT_STEP35_EXPORTABILITY_RECHECK_OUTPUT_PATH,
} = {}) {
  const depthDecisions = (stabilityReport.rows ?? []).map((row) => ({
    depth: row.depth,
    verdict: row.verdict,
    exportable: failures(row).length === 0,
    failures: failures(row),
  }));
  const decision = classify(stabilityReport.rows ?? []);
  const exportableDepths = depthDecisions.filter((entry) => entry.exportable).map((entry) => entry.depth);
  return {
    generatedAt: new Date().toISOString(),
    candidate: "S02 coverage-shadow stackDepth",
    decision,
    reason: [...new Set(depthDecisions.flatMap((entry) => entry.failures))],
    exportableDepths,
    nonExportableDepths: depthDecisions.filter((entry) => !entry.exportable).map((entry) => entry.depth),
    depthDecisions,
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

export async function writeS02ExportabilityRecheck({
  stabilityPath = DEFAULT_STEP35_STABILITY_INPUT_PATH,
  outputPath = DEFAULT_STEP35_EXPORTABILITY_RECHECK_OUTPUT_PATH,
  stabilityReport,
} = {}) {
  const report = stabilityReport ?? (await readJson(stabilityPath));
  return writeJsonReport(outputPath, recheckS02Exportability({ stabilityReport: report, outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02ExportabilityRecheck();
  console.log(JSON.stringify(report, null, 2));
}
