import fs from "node:fs/promises";
import path from "node:path";

import { loadActionValueDataset } from "./loadActionValueDataset.js";

const DEFAULT_DATASET_PATH = path.resolve("data/ai/action-value/iron-step4-action-value.jsonl");
const DEFAULT_OUTPUT_PATH = path.resolve("reports/ai-iron/iron-step4-rebalance-report.json");

function parseArgs(argv = []) {
  const options = {};
  argv.forEach((argument) => {
    if (!argument.startsWith("--")) return;
    const [rawKey, rawValue = "true"] = argument.slice(2).split("=");
    options[rawKey] = rawValue;
  });
  return {
    datasetPath: path.resolve(String(options.dataset ?? DEFAULT_DATASET_PATH)),
    outputPath: path.resolve(String(options.output ?? DEFAULT_OUTPUT_PATH)),
  };
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

export async function rebalanceIronDataset({
  datasetPath = DEFAULT_DATASET_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
} = {}) {
  const loaded = await loadActionValueDataset(datasetPath);
  const rows = loaded.validRows;
  const totalRows = Math.max(1, rows.length);
  const variantCounts = new Map();
  const bucketCounts = new Map();
  rows.forEach((row) => {
    variantCounts.set(row.variantId, (variantCounts.get(row.variantId) ?? 0) + 1);
    bucketCounts.set(row.bucket, (bucketCounts.get(row.bucket) ?? 0) + 1);
  });

  const variantWeightTotals = new Map();
  let totalRebalancedWeight = 0;
  for (const row of rows) {
    const variantShare = (variantCounts.get(row.variantId) ?? 0) / totalRows;
    const variantWeight = 1 / Math.sqrt(Math.max(variantShare, 1 / totalRows));
    const bucketShare = (bucketCounts.get(row.bucket) ?? 0) / totalRows;
    const bucketRarityWeight = 1 / Math.sqrt(Math.max(bucketShare, 1 / totalRows));
    const confidenceClip = Math.min(1, Math.max(0.5, Number(row.trainingWeight ?? 0) / Math.max(Number(row.trainingWeight ?? 1), 1)));
    const rebalancedWeight = Number(row.trainingWeight ?? 0) * variantWeight * bucketRarityWeight * confidenceClip;
    variantWeightTotals.set(row.variantId, (variantWeightTotals.get(row.variantId) ?? 0) + rebalancedWeight);
    totalRebalancedWeight += rebalancedWeight;
  }

  const variantRows = [...variantCounts.entries()].map(([variant, rawRows]) => {
    const rebalancedWeightShare = totalRebalancedWeight
      ? round((variantWeightTotals.get(variant) ?? 0) / totalRebalancedWeight, 4)
      : 0;
    return {
      variant,
      rawRows,
      rawShare: round(rawRows / totalRows, 4),
      rebalancedWeightShare,
    };
  });

  const report = {
    datasetPath,
    rows: totalRows,
    variantRows,
    totalRebalancedWeight: round(totalRebalancedWeight),
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await rebalanceIronDataset(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
}
