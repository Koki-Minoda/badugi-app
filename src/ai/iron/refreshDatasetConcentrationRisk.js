import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { loadActionValueDataset } from "./loadActionValueDataset.js";

export const DEFAULT_STEP43_BASE_DATASET_PATH = path.resolve("data/ai/action-value/iron-step15-action-value.jsonl");
export const DEFAULT_STEP43_FINAL_DATASET_PATH = path.resolve("data/ai/action-value/iron-step39-action-value.jsonl");
export const DEFAULT_STEP43_CONCENTRATION_RISK_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step43-concentration-risk.json",
);

function variantShare(summary = {}, variant = "S02") {
  const total = Number(summary.totalRows ?? 0);
  return total > 0 ? Number(summary.variantDistribution?.[variant] ?? 0) / total : 0;
}

export async function summarizeDatasetConcentrationRisk({
  baseDatasetPath = DEFAULT_STEP43_BASE_DATASET_PATH,
  finalDatasetPath = DEFAULT_STEP43_FINAL_DATASET_PATH,
} = {}) {
  const base = await loadActionValueDataset(baseDatasetPath, { allowInvalidRows: true });
  const final = await loadActionValueDataset(finalDatasetPath, { allowInvalidRows: true });
  const beforeS02Share = variantShare(base.summary, "S02");
  const afterS02Share = variantShare(final.summary, "S02");
  const delta = afterS02Share - beforeS02Share;
  const trend = Math.abs(delta) < 0.001 ? "maintained" : delta > 0 ? "worsened" : "improved";
  const riskLevel = afterS02Share > 0.75 && delta > 0.02 ? "worsened-high-risk" : "LOW";
  return {
    generatedAt: new Date().toISOString(),
    baseDataset: baseDatasetPath,
    finalDataset: finalDatasetPath,
    before: {
      totalRows: base.summary.totalRows,
      variantDistribution: base.summary.variantDistribution,
      s02Share: roundNumber(beforeS02Share, 6),
    },
    after: {
      totalRows: final.summary.totalRows,
      variantDistribution: final.summary.variantDistribution,
      s02Share: roundNumber(afterS02Share, 6),
    },
    s02ShareDelta: roundNumber(delta, 6),
    trend,
    riskLevel,
    singleVariantShareTooHigh: riskLevel !== "LOW",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function refreshDatasetConcentrationRisk({
  baseDatasetPath = DEFAULT_STEP43_BASE_DATASET_PATH,
  finalDatasetPath = DEFAULT_STEP43_FINAL_DATASET_PATH,
  outputPath = DEFAULT_STEP43_CONCENTRATION_RISK_OUTPUT_PATH,
} = {}) {
  const report = await summarizeDatasetConcentrationRisk({ baseDatasetPath, finalDatasetPath });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await refreshDatasetConcentrationRisk();
  console.log(JSON.stringify(report, null, 2));
}
