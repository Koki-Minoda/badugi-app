import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_OUTPUT_PATH = path.resolve("reports/ai-iron/iron-offline-arena-dryrun-plan.json");

export function createOfflineArenaDryRunPlan({
  datasetPath,
  qualityGate,
  rebalanceReport = null,
  candidateTier = "iron-candidate",
  variants = null,
  excludedVariants = [],
  reasonD01Excluded = "",
  outputPath = DEFAULT_OUTPUT_PATH,
} = {}) {
  return {
    candidateTier,
    dataset: datasetPath,
    variants: Array.isArray(variants) && variants.length ? [...variants] : Object.keys(qualityGate?.variantCoverage ?? {}),
    excludedVariants: Array.isArray(excludedVariants) ? [...excludedVariants] : [],
    reasonD01Excluded: reasonD01Excluded || undefined,
    variantCoverage: Object.keys(qualityGate?.variantCoverage ?? {}),
    variantRows: qualityGate?.variantCoverage ?? {},
    minimumVariantsRequired: Number(qualityGate?.minimumVariantsRequired ?? 0),
    maxSingleVariantShareAllowed: Number(qualityGate?.maxSingleVariantShareAllowed ?? 0),
    singleVariantShare: Number(qualityGate?.singleVariantShare ?? 0),
    deterministicReplay: Boolean(qualityGate?.deterministicReplay),
    invalidReplayCount: Number(qualityGate?.invalidReplayCount ?? 0),
    eligibleForOfflineArena: Boolean(qualityGate?.eligibleForOfflineArena),
    eligibleForPromotion: false,
    promoted: false,
    routingChanged: false,
    benchmarkOnlyRoutingPlan: true,
    noProductionRoutingMutation: true,
    noModelRegistryMutation: true,
    rebalanceSummary: rebalanceReport
      ? {
          rows: Number(rebalanceReport.rows ?? 0),
          variantRows: Array.isArray(rebalanceReport.variantRows) ? rebalanceReport.variantRows : [],
        }
      : null,
    outputPath,
  };
}

export async function writeOfflineArenaDryRunPlan({
  datasetPath,
  qualityGate,
  rebalanceReport = null,
  candidateTier = "iron-candidate",
  variants = null,
  excludedVariants = [],
  reasonD01Excluded = "",
  outputPath = DEFAULT_OUTPUT_PATH,
} = {}) {
  const plan = createOfflineArenaDryRunPlan({
    datasetPath,
    qualityGate,
    rebalanceReport,
    candidateTier,
    variants,
    excludedVariants,
    reasonD01Excluded,
    outputPath,
  });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(plan, null, 2), "utf8");
  return plan;
}
