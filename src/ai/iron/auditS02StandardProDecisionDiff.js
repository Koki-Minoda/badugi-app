import fs from "node:fs/promises";
import path from "node:path";

import { DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH, runFocusedS02Counterfactual } from "./runFocusedS02Counterfactual.js";
import {
  average,
  countBy,
  focusedObservationAxisValue,
  rowsFromFocusedReport,
  signFlipRate,
  writeStep28Report,
} from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP28_STANDARD_PRO_DECISION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-standard-pro-decision-audit-step28.json",
);

const TRACKED_PAIRS = new Set(["CALL/FOLD", "CHECK/BET", "CALL/RAISE"]);

async function loadFocusedReport() {
  try {
    return JSON.parse(await fs.readFile(DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return runFocusedS02Counterfactual({ runReplay: false });
  }
}

function interpretationFor(pair, signFlip, sampleCount) {
  if (sampleCount < 10) return "low sample";
  if (signFlip > 0.25) return "noisy broad-equilibrium signal";
  if (pair === "CALL/FOLD") return "Standard continuation over Pro overfold";
  if (pair === "CHECK/BET") return "Standard pot control over Pro bet";
  if (pair === "CALL/RAISE") return "Standard flat call over Pro raise";
  return "untracked";
}

export function auditS02StandardProDecisionDiff({ focusedReport = null, rows = null } = {}) {
  const inputRows = rows ?? rowsFromFocusedReport(focusedReport ?? {});
  const grouped = new Map();
  inputRows
    .filter((row) => TRACKED_PAIRS.has(`${row.standardAction}/${row.proAction}`))
    .forEach((row) => {
      const key = `${row.standardAction}/${row.proAction}|${focusedObservationAxisValue(row, "position")}|${focusedObservationAxisValue(row, "drawRound")}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });
  const decisions = [...grouped.entries()]
    .map(([key, group]) => {
      const [pair, position, drawRound] = key.split("|");
      const signFlip = signFlipRate(group.map((row) => row.delta));
      return {
        pair,
        position,
        drawRound,
        sampleCount: group.length,
        meanDelta: Number(average(group.map((row) => row.delta)).toFixed(4)),
        signFlipRate: signFlip,
        actionDistribution: countBy(group, (row) => `${row.standardAction}/${row.proAction}`),
        interpretation: interpretationFor(pair, signFlip, group.length),
      };
    })
    .sort((left, right) => right.sampleCount - left.sampleCount || Math.abs(right.meanDelta) - Math.abs(left.meanDelta));
  return {
    generatedAt: new Date().toISOString(),
    bucket: focusedReport?.bucket ?? "S02 lowerMediumSDA5 bet-pressure",
    trackedPairs: Array.from(TRACKED_PAIRS).sort(),
    decisions,
    mainInterpretation: decisions[0]?.interpretation ?? "no tracked decision difference",
    outputPath: DEFAULT_STEP28_STANDARD_PRO_DECISION_OUTPUT_PATH,
  };
}

export async function writeS02StandardProDecisionAudit({
  outputPath = DEFAULT_STEP28_STANDARD_PRO_DECISION_OUTPUT_PATH,
  ...input
} = {}) {
  const focusedReport = input.focusedReport ?? (input.rows ? null : await loadFocusedReport());
  const report = auditS02StandardProDecisionDiff({ ...input, focusedReport });
  return writeStep28Report(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02StandardProDecisionAudit();
  console.log(JSON.stringify(report, null, 2));
}
