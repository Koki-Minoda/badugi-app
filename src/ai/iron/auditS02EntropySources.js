import fs from "node:fs/promises";
import path from "node:path";

import { DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH, runFocusedS02Counterfactual } from "./runFocusedS02Counterfactual.js";
import {
  countBy,
  entropyFromCounts,
  focusedObservationAxisValue,
  rowsFromFocusedReport,
  writeStep28Report,
} from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP28_ENTROPY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-entropy-audit-step28.json",
);

async function loadFocusedReport() {
  try {
    return JSON.parse(await fs.readFile(DEFAULT_STEP28_FOCUSED_COUNTERFACTUAL_OUTPUT_PATH, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return runFocusedS02Counterfactual({ runReplay: false });
  }
}

function classifyEntropy(score = 0, repairRate = 0) {
  if (score >= 0.85 || repairRate > 0.2) return "UNEXPORTABLE";
  if (score >= 0.6) return "HIGH_ENTROPY";
  if (score >= 0.3) return "MODERATE_ENTROPY";
  return "LOW_ENTROPY";
}

export function auditS02EntropySources({ focusedReport = null, rows = null } = {}) {
  const inputRows = rows ?? rowsFromFocusedReport(focusedReport ?? {});
  const sources = [
    ["actionDistributionEntropy", entropyFromCounts(countBy(inputRows, (row) => `${row.standardAction}/${row.proAction}`))],
    ["fallbackEntropy", entropyFromCounts(countBy(inputRows, (row) => row.proAction))],
    ["pressureEntropy", entropyFromCounts(countBy(inputRows, (row) => focusedObservationAxisValue(row, "pressureChain")))],
    ["callBandEntropy", entropyFromCounts(countBy(inputRows, (row) => focusedObservationAxisValue(row, "callBand")))],
    ["positionEntropy", entropyFromCounts(countBy(inputRows, (row) => focusedObservationAxisValue(row, "position")))],
  ].map(([source, entropy]) => ({
    source,
    entropy,
    severity: entropy >= 0.75 ? "HIGH" : entropy >= 0.35 ? "MEDIUM" : "LOW",
  }));
  const sourceMax = Math.max(0, ...sources.map((source) => Number(source.entropy ?? 0)));
  const entropyScore =
    focusedReport?.entropyScore ??
    sources.reduce((sum, source) => sum + Number(source.entropy ?? 0), 0) / Math.max(1, sources.length);
  const effectiveEntropyScore = Math.max(entropyScore, sourceMax);
  const classification = classifyEntropy(effectiveEntropyScore, focusedReport?.repairRate ?? 0);
  return {
    generatedAt: new Date().toISOString(),
    bucket: focusedReport?.bucket ?? "S02 lowerMediumSDA5 bet-pressure",
    entropyScore,
    effectiveEntropyScore,
    classification,
    sources,
    broadBucketCollapseCause:
      sources
        .filter((source) => source.severity !== "LOW")
        .map((source) => source.source)
        .join(", ") || "none",
    outputPath: DEFAULT_STEP28_ENTROPY_OUTPUT_PATH,
  };
}

export async function writeS02EntropyAudit({
  outputPath = DEFAULT_STEP28_ENTROPY_OUTPUT_PATH,
  ...input
} = {}) {
  const focusedReport = input.focusedReport ?? (input.rows ? null : await loadFocusedReport());
  const report = auditS02EntropySources({ ...input, focusedReport });
  return writeStep28Report(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeS02EntropyAudit();
  console.log(JSON.stringify(report, null, 2));
}
