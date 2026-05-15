import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP34_CROSS_DEPTH_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-cross-depth-consistency-step34.json",
);
export const DEFAULT_STEP34_STABILITY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-stability-step34.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function direction(row = {}) {
  if (Number(row.valid ?? 0) <= 0) return "NO_SIGNAL";
  if (Number(row.meanDelta ?? 0) > 0) return "POSITIVE";
  if (Number(row.meanDelta ?? 0) < 0) return "NEGATIVE";
  return "FLAT";
}

function consistencyFor(rows = []) {
  const signaled = rows.filter((row) => direction(row) !== "NO_SIGNAL");
  const directions = new Set(signaled.map(direction).filter((value) => value !== "FLAT"));
  if (!signaled.length) return "NO_SIGNAL";
  if (directions.size <= 1 && signaled.length === rows.length) return "CONSISTENT";
  if (directions.size <= 1) return "PARTIAL";
  return "INCONSISTENT";
}

export function checkS02CrossDepthConsistency({ stabilityReport = {} } = {}) {
  const rows = stabilityReport.rows ?? [];
  const evaluated = rows.map((row) => ({ ...row, direction: direction(row) }));
  const signaled = evaluated.filter((row) => row.direction !== "NO_SIGNAL");
  const best = [...signaled].sort((left, right) => Number(right.meanDelta ?? 0) - Number(left.meanDelta ?? 0))[0] ?? null;
  const worst = [...signaled].sort((left, right) => Number(left.meanDelta ?? 0) - Number(right.meanDelta ?? 0))[0] ?? null;
  const consistency = consistencyFor(evaluated);
  return {
    generatedAt: new Date().toISOString(),
    consistency,
    directionConsistent: consistency === "CONSISTENT",
    bestDepth: best?.stackDepth ?? null,
    worstDepth: worst?.stackDepth ?? null,
    rows: evaluated,
    exportable: false,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP34_CROSS_DEPTH_OUTPUT_PATH,
  };
}

export async function writeS02CrossDepthConsistency({
  stabilityPath = DEFAULT_STEP34_STABILITY_INPUT_PATH,
  outputPath = DEFAULT_STEP34_CROSS_DEPTH_OUTPUT_PATH,
  stabilityReport,
} = {}) {
  const report = stabilityReport ?? (await readJsonIfExists(stabilityPath));
  return writeJsonReport(outputPath, checkS02CrossDepthConsistency({ stabilityReport: report }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02CrossDepthConsistency();
  console.log(JSON.stringify(report, null, 2));
}
