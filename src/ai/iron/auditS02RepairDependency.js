import fs from "node:fs/promises";
import path from "node:path";

import { DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH, runFocusedS02Counterfactual } from "./runFocusedS02Counterfactual.js";
import {
  countBy,
  rowsFromFocusedReport,
  signFlipRate,
  writeStep28Report,
} from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP28_REPAIR_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-repair-dependency-step28.json",
);

async function loadFocusedReport() {
  try {
    return JSON.parse(await fs.readFile(DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return runFocusedS02Counterfactual({ runReplay: false });
  }
}

function verdictFor(repairRate = 0, invalidReplayCount = 0) {
  if (invalidReplayCount > 0 && repairRate > 0.2) return "UNEXPORTABLE";
  if (repairRate > 0.2) return "REPAIR_HEAVY";
  if (repairRate > 0.1 || invalidReplayCount > 0) return "RISKY";
  return "SAFE";
}

export function auditS02RepairDependency({ focusedReport = null, rows = null } = {}) {
  const inputRows = rows ?? rowsFromFocusedReport(focusedReport ?? {});
  const repairRows = inputRows.filter((row) => row.legality?.repairRequired || row.repairRequired);
  const positiveRows = inputRows.filter((row) => Number(row.delta ?? 0) > 0);
  const unrepairedRows = inputRows.filter((row) => !(row.legality?.repairRequired || row.repairRequired));
  const repairRate = focusedReport?.repairRate ?? (inputRows.length ? repairRows.length / inputRows.length : 0);
  const repairTypeBreakdown = countBy(repairRows, (row) => row.legality?.repairType ?? row.repairType ?? "UNKNOWN");
  const repairRequiredForPositiveEV = positiveRows.length
    ? repairRows.filter((row) => Number(row.delta ?? 0) > 0).length / positiveRows.length
    : 0;
  const repairRemovesSignFlip = signFlipRate(unrepairedRows.map((row) => row.delta)) < signFlipRate(inputRows.map((row) => row.delta));
  const verdict = verdictFor(repairRate, focusedReport?.invalidReplayCount ?? 0);
  return {
    generatedAt: new Date().toISOString(),
    bucket: focusedReport?.bucket ?? "S02 lowerMediumSDA5 bet-pressure",
    repairRate: Number(repairRate.toFixed ? repairRate.toFixed(4) : repairRate),
    repairTypeBreakdown,
    repairRequiredForPositiveEV: Number(repairRequiredForPositiveEV.toFixed(4)),
    repairRemovesSignFlip,
    invalidReplayCount: focusedReport?.invalidReplayCount ?? inputRows.filter((row) => row.ok === false).length,
    staleActionDependency: Boolean(repairTypeBreakdown.STALE_RAISE || repairTypeBreakdown.ACTION_NOT_IN_REFRESHED_LEGAL),
    raiseToCallRepairRate: inputRows.length ? Number(((repairTypeBreakdown.RAISE_TO_CALL ?? 0) / inputRows.length).toFixed(4)) : 0,
    verdict,
    outputPath: DEFAULT_STEP28_REPAIR_OUTPUT_PATH,
  };
}

export async function writeS02RepairDependencyAudit({
  outputPath = DEFAULT_STEP28_REPAIR_OUTPUT_PATH,
  ...input
} = {}) {
  const focusedReport = input.focusedReport ?? (input.rows ? null : await loadFocusedReport());
  const report = auditS02RepairDependency({ ...input, focusedReport });
  return writeStep28Report(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02RepairDependencyAudit();
  console.log(JSON.stringify(report, null, 2));
}
