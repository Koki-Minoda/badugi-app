import fs from "node:fs/promises";
import path from "node:path";

import { loadActionValueDataset } from "./loadActionValueDataset.js";
import { writeOfflineArenaDryRunPlan } from "./createOfflineArenaDryRunPlan.js";

const DEFAULT_DATASET_PATH = path.resolve("data/ai/action-value/iron-step7-action-value.jsonl");
const REQUIRED_VARIANTS = ["D02", "S01", "S02"];

function inferTagFromDatasetPath(datasetPath = "") {
  const match = path.basename(String(datasetPath)).match(/^(.*?)-action-value\.jsonl$/i);
  return match?.[1] ?? "iron-step7";
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

export async function checkIronDryRunEligibility({
  datasetPath = DEFAULT_DATASET_PATH,
  outputPath = null,
} = {}) {
  const tag = inferTagFromDatasetPath(datasetPath);
  const loaded = await loadActionValueDataset(datasetPath);
  const determinismPath = path.resolve(`reports/ai-eval/replay-determinism-audit-${tag}.json`);
  const determinism = await readJsonIfExists(determinismPath);
  const resolvedOutputPath = outputPath ?? path.resolve(`reports/ai-iron/iron-dryrun-eligibility-${tag}.json`);
  const variantCoverage = loaded.summary.variantDistribution ?? {};
  const presentVariants = new Set(Object.keys(variantCoverage));
  const requiredVariantsPresent = REQUIRED_VARIANTS.every((variantId) => presentVariants.has(variantId));
  const okForThreeVariantDryRun =
    loaded.summary.validRows > 0 &&
    loaded.summary.invalidRows === 0 &&
    loaded.summary.trainingAllowed &&
    requiredVariantsPresent &&
    Boolean(determinism?.deterministic);

  const result = {
    datasetPath,
    requiredVariants: REQUIRED_VARIANTS,
    variantCoverage,
    validRows: loaded.summary.validRows,
    invalidRows: loaded.summary.invalidRows,
    deterministicReplay: Boolean(determinism?.deterministic),
    okForThreeVariantDryRun,
    okForFourVariantIronCandidate: false,
    reasonD01Excluded: "no STABLE_STANDARD_BETTER bucket; STABLE_PRO_BETTER only",
    eligibleForPromotion: false,
    routingChanged: false,
    promoted: false,
  };

  await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await fs.writeFile(resolvedOutputPath, JSON.stringify(result, null, 2), "utf8");
  await writeOfflineArenaDryRunPlan({
    datasetPath,
    qualityGate: {
      variantCoverage,
      minimumVariantsRequired: 3,
      maxSingleVariantShareAllowed: 0.55,
      singleVariantShare: Math.max(
        0,
        ...Object.values(variantCoverage).map((value) => value / Math.max(1, loaded.summary.validRows)),
      ),
      deterministicReplay: Boolean(determinism?.deterministic),
      invalidReplayCount: 0,
      eligibleForOfflineArena: okForThreeVariantDryRun,
    },
    candidateTier: "iron-candidate-dryrun",
    variants: REQUIRED_VARIANTS,
    excludedVariants: ["D01"],
    reasonD01Excluded: result.reasonD01Excluded,
    outputPath: path.resolve("reports/ai-iron/iron-step8-offline-arena-plan.json"),
  });
  return result;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = await checkIronDryRunEligibility(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
