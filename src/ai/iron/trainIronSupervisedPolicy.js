import fs from "node:fs/promises";
import path from "node:path";

import { loadActionValueDataset } from "./loadActionValueDataset.js";
import { createIronCandidateMetadata } from "./createIronCandidateMetadata.js";
import { validateActionValueDataset } from "../evaluation/validateActionValueDataset.js";

const DEFAULT_DATASET_PATH = path.resolve("data/ai/action-value/iron-step2-action-value.jsonl");
const REPORT_OUTPUT_PATH = path.resolve("reports/ai-iron/iron-supervised-step2.json");
const METADATA_OUTPUT_PATH = path.resolve("reports/ai-iron/iron-candidate-step2-metadata.json");
const DOC_OUTPUT_PATH = path.resolve("docs/ai/MGX_IRON_BOOTSTRAP_STEP2_REPORT.md");
const DIVERGENCE_REPLAY_DIR = path.resolve("reports/ai-eval/divergence-replay-samples");

function parseArgs(argv = []) {
  const options = {};
  argv.forEach((argument) => {
    if (!argument.startsWith("--")) return;
    const [rawKey, rawValue = "true"] = argument.slice(2).split("=");
    options[rawKey] = rawValue;
  });
  return {
    datasetPath: path.resolve(String(options.dataset ?? DEFAULT_DATASET_PATH)),
    validationSplit: Math.min(0.5, Math.max(0.1, Number(options["validation-split"] ?? 0.2))),
    corpusTag: String(options["corpus-tag"] ?? "iron-step2"),
    freshHandsLabel: String(options["fresh-hands-label"] ?? "500 hand x 3 seed"),
  };
}

function actionType(action = null) {
  return String(action?.type ?? action?.action ?? action ?? "").toUpperCase();
}

function incrementDistribution(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function splitRows(rows = [], validationSplit = 0.2) {
  const validationCount = Math.max(1, Math.floor(rows.length * validationSplit));
  return {
    trainRows: rows.slice(0, Math.max(0, rows.length - validationCount)),
    validationRows: rows.slice(Math.max(0, rows.length - validationCount)),
  };
}

function summarizeWeights(rows = []) {
  if (!rows.length) {
    return {
      totalWeight: 0,
      averageWeight: 0,
      minWeight: 0,
      maxWeight: 0,
    };
  }
  const weights = rows.map((row) => Number(row.trainingWeight) || 0);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  return {
    totalWeight: round(totalWeight),
    averageWeight: round(totalWeight / rows.length),
    minWeight: round(Math.min(...weights)),
    maxWeight: round(Math.max(...weights)),
  };
}

function buildDistributions(rows = []) {
  const variantDistribution = new Map();
  const bucketDistribution = new Map();
  const actionDistribution = new Map();
  rows.forEach((row) => {
    incrementDistribution(variantDistribution, row.variantId);
    incrementDistribution(bucketDistribution, row.bucket);
    incrementDistribution(actionDistribution, actionType(row.chosenBestAction));
  });
  return {
    variantDistribution: Object.fromEntries(variantDistribution),
    bucketDistribution: Object.fromEntries(bucketDistribution),
    actionDistribution: Object.fromEntries(actionDistribution),
  };
}

function buildLabelMapping(rows = []) {
  const labels = [...new Set(rows.map((row) => actionType(row.chosenBestAction)).filter(Boolean))].sort();
  return Object.fromEntries(labels.map((label, index) => [label, index]));
}

function computeBaselineLoss(rows = [], labelMapping = {}) {
  if (!rows.length) return 0;
  const labelCount = Math.max(1, Object.keys(labelMapping).length);
  const weightedMass = rows.reduce((sum, row) => sum + (Number(row.trainingWeight) || 0), 0);
  return round((weightedMass / rows.length) * (1 / labelCount));
}

function buildStep2Report(summary) {
  const variantCoverage = Object.entries(summary.variantDistribution ?? {})
    .map(([variant, count]) => `${variant}:${count}`)
    .join(", ");
  const sparseWarnings = (summary.warnings ?? []).join(", ") || "none";
  const stableBuckets = Object.entries(summary.bucketDistribution ?? {})
    .map(([bucket, count]) => `${bucket}:${count}`)
    .join(", ");
  return `# MGX Iron Bootstrap Step2 Report

| Item | Result |
| ---- | ------ |
| Corpus tag | \`${summary.corpusTag}\` |
| Fresh hands | \`${summary.freshHands}\` |
| Replay samples | \`${summary.replaySamples}\` |
| Counterfactual valid | \`${summary.counterfactualValid}\` |
| Counterfactual invalid | \`${summary.counterfactualInvalid}\` |
| Dataset rows | \`${summary.rows}\` |
| Valid rows | \`${summary.validRows}\` |
| Variant coverage | \`${variantCoverage || "none"}\` |
| Training allowed | \`${summary.trainingAllowed}\` |
| Candidate metadata | \`${summary.candidateMetadata ? "YES" : "NO"}\` |
| Promoted | NO |

## Dataset Bias

| Variant | Rows | Share | Risk |
| ------- | ---: | ----: | ---- |
${Object.entries(summary.variantDistribution ?? {})
  .map(([variant, count]) => {
    const share = summary.rows ? round((count / summary.rows) * 100, 2) : 0;
    const risk = share >= 70 ? "high bias" : share >= 40 ? "moderate bias" : "low";
    return `| ${variant} | ${count} | ${share}% | ${risk} |`;
  })
  .join("\n")}

## Stable Buckets

| Variant | Bucket | Rows | Confidence | Use |
| ------- | ------ | ---: | ---------: | --- |
${Object.entries(summary.bucketDistribution ?? {})
  .map(([bucket, count]) => `| ${summary.mainVariant ?? "mixed"} | ${bucket} | ${count} | n/a | supervised bootstrap candidate |`)
  .join("\n")}

## Noisy Buckets Excluded

| Variant | Bucket | Reason |
| ------- | ------ | ------ |
| S01/S02 | noisy replay buckets | excluded from iron-step2 dataset export because verdict was not stable |

## Notes

- Sparse warnings: ${sparseWarnings}
- Remaining limitations: replay-derived supervision remains sparse and D02-heavy.
- Next RL phase: expand stable S01/S02 buckets or move into broader offline policy/value training with additional corpus collection.
- Current stable buckets: ${stableBuckets || "none"}.
`;
}

async function countReplaySamplesForTag(tag = "iron-step2") {
  const entries = await fs.readdir(DIVERGENCE_REPLAY_DIR).catch(() => []);
  const matched = entries.filter(
    (entry) => entry.startsWith(`${String(tag).toLowerCase()}-`) && entry.endsWith(".jsonl"),
  );
  let total = 0;
  for (const entry of matched) {
    const content = await fs.readFile(path.join(DIVERGENCE_REPLAY_DIR, entry), "utf8");
    total += content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean).length;
  }
  return total;
}

export async function trainIronSupervisedPolicy({
  datasetPath = DEFAULT_DATASET_PATH,
  validationSplit = 0.2,
  corpusTag = "iron-step2",
  freshHandsLabel = "500 hand x 3 seed",
  reportOutputPath = REPORT_OUTPUT_PATH,
  metadataOutputPath = METADATA_OUTPUT_PATH,
  docOutputPath = DOC_OUTPUT_PATH,
} = {}) {
  const validation = await validateActionValueDataset({
    datasetPath,
    writeArtifacts: false,
  });
  const loaded = await loadActionValueDataset(datasetPath);
  const warnings = [...new Set([
    ...loaded.warnings,
    ...(validation.trainingAllowed ? [] : ["training-gate-blocked"]),
  ])];
  if (!validation.trainingAllowed || !loaded.validRows.length) {
    const blocked = {
      tier: "iron-candidate",
      trainingType: "supervised-policy-bootstrap",
      dataset: datasetPath,
      rows: loaded.summary.totalRows,
      validRows: loaded.summary.validRows,
      invalidRows: loaded.summary.invalidRows,
      trainingAllowed: false,
      warnings,
      promoted: false,
      eligibleForPromotion: false,
      routingChanged: false,
      candidateMetadata: null,
    };
    await fs.mkdir(path.dirname(reportOutputPath), { recursive: true });
    await fs.mkdir(path.dirname(docOutputPath), { recursive: true });
    await fs.writeFile(reportOutputPath, JSON.stringify(blocked, null, 2), "utf8");
    await fs.writeFile(docOutputPath, buildStep2Report({
      corpusTag: "iron-step2",
      freshHands: "not-run",
      replaySamples: 0,
      counterfactualValid: 0,
      counterfactualInvalid: 0,
      rows: loaded.summary.totalRows,
      validRows: loaded.summary.validRows,
      variantDistribution: loaded.summary.variantDistribution,
      trainingAllowed: false,
      candidateMetadata: null,
      warnings,
      bucketDistribution: loaded.summary.bucketDistribution,
      mainVariant: Object.keys(loaded.summary.variantDistribution ?? {})[0] ?? "mixed",
    }), "utf8");
    return blocked;
  }

  const { trainRows, validationRows } = splitRows(loaded.validRows, validationSplit);
  const labelMapping = buildLabelMapping(loaded.validRows);
  const distributions = buildDistributions(loaded.validRows);
  const weightSummary = summarizeWeights(loaded.validRows);
  const replaySamples = await countReplaySamplesForTag(corpusTag);
  const candidateMetadata = createIronCandidateMetadata({
    datasetSource: datasetPath,
    summary: loaded.summary,
    warnings,
  });
  const result = {
    tier: "iron-candidate",
    trainingType: "supervised-policy-bootstrap",
    dataset: datasetPath,
    rows: loaded.summary.totalRows,
    validRows: loaded.summary.validRows,
    invalidRows: loaded.summary.invalidRows,
    trainingAllowed: true,
    trainRows: trainRows.length,
    validationRows: validationRows.length,
    variantDistribution: distributions.variantDistribution,
    bucketDistribution: distributions.bucketDistribution,
    actionDistribution: distributions.actionDistribution,
    labelMapping,
    confidenceWeightedSummary: weightSummary,
    baselineLossPlaceholder: computeBaselineLoss(trainRows, labelMapping),
    warnings,
    promoted: false,
    eligibleForPromotion: false,
    routingChanged: false,
    candidateMetadata: {
      ...candidateMetadata,
      trainingType: "supervised-policy-bootstrap",
      validationSplit,
      promoted: false,
      eligibleForPromotion: false,
      routingChanged: false,
    },
  };

  await fs.mkdir(path.dirname(reportOutputPath), { recursive: true });
  await fs.mkdir(path.dirname(metadataOutputPath), { recursive: true });
  await fs.mkdir(path.dirname(docOutputPath), { recursive: true });
  await fs.writeFile(reportOutputPath, JSON.stringify(result, null, 2), "utf8");
  await fs.writeFile(metadataOutputPath, JSON.stringify(result.candidateMetadata, null, 2), "utf8");

  let counterfactualValid = 0;
  let counterfactualInvalid = 0;
  try {
    const counterfactual = JSON.parse(
      await fs.readFile(
        path.resolve("reports/ai-eval", `counterfactual-score-d02-s01-s02-${String(corpusTag).toLowerCase()}.json`),
        "utf8",
      ),
    );
    counterfactualValid = Number(counterfactual.validReplays ?? 0);
    counterfactualInvalid = Number(counterfactual.invalidReplays ?? 0);
  } catch {
    // Keep report generation resilient when counterfactual has not yet run.
  }

  await fs.writeFile(docOutputPath, buildStep2Report({
    corpusTag,
    freshHands: freshHandsLabel,
    replaySamples,
    counterfactualValid,
    counterfactualInvalid,
    rows: loaded.summary.totalRows,
    validRows: loaded.summary.validRows,
    variantDistribution: distributions.variantDistribution,
    trainingAllowed: true,
    candidateMetadata: result.candidateMetadata,
    warnings,
    bucketDistribution: distributions.bucketDistribution,
    mainVariant: Object.keys(distributions.variantDistribution ?? {})[0] ?? "mixed",
  }), "utf8");

  return result;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = await trainIronSupervisedPolicy(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
