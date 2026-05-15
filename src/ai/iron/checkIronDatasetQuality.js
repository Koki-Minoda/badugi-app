import fs from "node:fs/promises";
import path from "node:path";

import { loadActionValueDataset } from "./loadActionValueDataset.js";
import { writeOfflineArenaMetadata } from "./createOfflineArenaMetadata.js";
import { writeOfflineArenaDryRunPlan } from "./createOfflineArenaDryRunPlan.js";

const DEFAULT_DATASET_PATH = path.resolve("data/ai/action-value/iron-step2-action-value.jsonl");

function inferTagFromDatasetPath(datasetPath = "") {
  const match = path.basename(String(datasetPath)).match(/^(.*?)-action-value\.jsonl$/i);
  return match?.[1] ?? "iron-step2";
}

function getQualityThresholds(tag = "iron-step2") {
  const normalized = String(tag).toLowerCase();
  if (normalized === "iron-step6" || normalized === "iron-step7") {
    return {
      minimumVariants: 4,
      maxSingleVariantShare: 0.45,
    };
  }
  return {
    minimumVariants: 3,
    maxSingleVariantShare: 0.55,
  };
}

function parseArgs(argv = []) {
  const options = {};
  argv.forEach((argument) => {
    if (!argument.startsWith("--")) return;
    const [rawKey, rawValue = "true"] = argument.slice(2).split("=");
    options[rawKey] = rawValue;
  });
  return {
    datasetPath: path.resolve(String(options.dataset ?? DEFAULT_DATASET_PATH)),
    determinismPath:
      typeof options["determinism-report"] === "string" && options["determinism-report"].trim().length
        ? path.resolve(String(options["determinism-report"]))
        : null,
    counterfactualPath:
      typeof options["counterfactual-report"] === "string" && options["counterfactual-report"].trim().length
        ? path.resolve(String(options["counterfactual-report"]))
        : null,
    outputPath:
      typeof options.output === "string" && options.output.trim().length
        ? path.resolve(String(options.output))
        : null,
  };
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function resolveCounterfactualPath(tag = "iron-step2", explicitPath = null) {
  if (explicitPath) return explicitPath;
  const reportDir = path.resolve("reports/ai-eval");
  const entries = await fs.readdir(reportDir).catch(() => []);
  const target = entries.find(
    (entry) =>
      entry.startsWith("counterfactual-score-") &&
      entry.endsWith(`-${tag}.json`),
  );
  return target ? path.join(reportDir, target) : path.resolve(`reports/ai-eval/counterfactual-score-d02-s01-s02-${tag}.json`);
}

async function resolveEntropyPath(tag = "iron-step2") {
  const candidates = [
    path.resolve(`reports/ai-eval/d01-bucket-entropy-${tag}.json`),
    path.resolve(`reports/ai-eval/d01-bucket-entropy-${String(tag).replace(/^iron-/, "")}.json`),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return candidates[0];
}

export async function checkIronDatasetQuality({
  datasetPath = DEFAULT_DATASET_PATH,
  determinismPath = null,
  counterfactualPath = null,
  outputPath = null,
  rebalancePath = null,
} = {}) {
  const tag = inferTagFromDatasetPath(datasetPath);
  const thresholds = getQualityThresholds(tag);
  const resolvedDeterminismPath =
    determinismPath ?? path.resolve(`reports/ai-eval/replay-determinism-audit-${tag}.json`);
  const resolvedCounterfactualPath = await resolveCounterfactualPath(tag, counterfactualPath);
  const resolvedOutputPath = outputPath ?? path.resolve(`reports/ai-iron/iron-dataset-quality-${tag}.json`);
  const resolvedRebalancePath = rebalancePath ?? path.resolve(`reports/ai-iron/${tag}-rebalance-report.json`);
  const resolvedEntropyPath = await resolveEntropyPath(tag);
  const loaded = await loadActionValueDataset(datasetPath);
  const determinism = await readJsonIfExists(resolvedDeterminismPath);
  const counterfactual = await readJsonIfExists(resolvedCounterfactualPath);
  const rebalanceReport = await readJsonIfExists(resolvedRebalancePath);
  const entropyReport = await readJsonIfExists(resolvedEntropyPath);

  const blockers = [];
  const warnings = [...loaded.warnings];
  const variantCount = Object.keys(loaded.summary.variantDistribution ?? {}).length;
  const singleVariantShare = Math.max(
    0,
    ...Object.values(loaded.summary.variantDistribution ?? {}).map((value) => value / Math.max(1, loaded.summary.validRows)),
  );
  const invalidReplayCount = Number(counterfactual?.invalidReplays ?? 0);
  const deterministicReplay = determinism ? Boolean(determinism.deterministic) : false;
  const d01StableBucketCount = Object.entries(loaded.summary.bucketDistribution ?? {}).filter(
    ([bucket]) => String(bucket).toLowerCase().includes("premium27td") || String(bucket).toLowerCase().includes("strong27td"),
  ).length;

  if (loaded.summary.invalidRows > 0) blockers.push("invalid-dataset-rows");
  if (loaded.summary.validRows === 0) blockers.push("empty-dataset");
  if (variantCount < thresholds.minimumVariants) warnings.push("single-variant-coverage");
  if (singleVariantShare > thresholds.maxSingleVariantShare) warnings.push("single-variant-dominance");
  if (invalidReplayCount > 0) warnings.push("invalid-replay-present");
  if (!determinism) warnings.push("missing-determinism-audit");
  if (determinism && !deterministicReplay) warnings.push("replay-not-fully-deterministic");

  const okForSupervisedTraining = blockers.length === 0 && loaded.summary.trainingAllowed;
  const okForIronCandidate =
    okForSupervisedTraining &&
    variantCount >= thresholds.minimumVariants &&
    singleVariantShare <= thresholds.maxSingleVariantShare &&
    invalidReplayCount === 0 &&
    deterministicReplay;
  const eligibleForOfflineArena =
    okForSupervisedTraining &&
    variantCount >= thresholds.minimumVariants &&
    singleVariantShare <= thresholds.maxSingleVariantShare &&
    invalidReplayCount === 0 &&
    deterministicReplay;

  if (!okForIronCandidate) {
    if (variantCount < thresholds.minimumVariants) blockers.push("insufficient-variant-coverage-for-iron-candidate");
    if (normalizedTagRequiresD01(tag) && d01StableBucketCount < 1) blockers.push("missing-d01-stable-bucket");
    if (singleVariantShare > thresholds.maxSingleVariantShare) blockers.push("single-variant-share-too-high");
    if (invalidReplayCount > 0) blockers.push("counterfactual-invalid-replay-present");
    if (!deterministicReplay) blockers.push("replay-determinism-gate-failed");
  }

  const result = {
    datasetPath,
    determinismPath: resolvedDeterminismPath,
    counterfactualPath: resolvedCounterfactualPath,
    rows: loaded.summary.totalRows,
    validRows: loaded.summary.validRows,
    invalidRows: loaded.summary.invalidRows,
    variantCoverage: loaded.summary.variantDistribution,
    d01StableBucketCount,
    entropyReportPath: entropyReport ? resolvedEntropyPath : null,
    minimumVariantsRequired: thresholds.minimumVariants,
    maxSingleVariantShareAllowed: thresholds.maxSingleVariantShare,
    singleVariantShare: Number(singleVariantShare.toFixed(4)),
    invalidReplayCount,
    deterministicReplay,
    okForSupervisedTraining,
    okForIronCandidate,
    eligibleForOfflineArena,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    promoted: false,
    eligibleForPromotion: false,
  };

  await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await fs.writeFile(resolvedOutputPath, JSON.stringify(result, null, 2), "utf8");
  await writeOfflineArenaMetadata({
    datasetPath,
    qualityGate: result,
  });
  await writeOfflineArenaDryRunPlan({
    datasetPath,
    qualityGate: result,
    rebalanceReport,
  });
  return result;
}

function normalizedTagRequiresD01(tag = "") {
  const normalized = String(tag).toLowerCase();
  return normalized === "iron-step7";
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = await checkIronDatasetQuality(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
