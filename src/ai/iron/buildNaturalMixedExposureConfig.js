import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const STEP45_TABLE_SIZE_WEIGHTS = {
  "6max": 0.5,
  "4max": 0.25,
  "3way": 0.25,
};

export const STEP45_SEED_SCHEDULE = [20261021, 20261022, 20261023];

export const DEFAULT_STEP45_NATURAL_EXPOSURE_CONFIG_PATH = path.resolve(
  "reports/ai-iron/step45-natural-exposure-config.json",
);

export function buildNaturalMixedExposureConfig({
  tableSizeWeights = STEP45_TABLE_SIZE_WEIGHTS,
  seedSchedule = STEP45_SEED_SCHEDULE,
  hands = 18000,
  variants = ["D02", "S01", "S02"],
} = {}) {
  return {
    generatedAt: new Date().toISOString(),
    step: "Step45",
    purpose: "natural mixed exposure recovery without synthetic opportunity creation",
    datasetPath: "data/ai/action-value/iron-step39-action-value.jsonl",
    variants,
    hands,
    seedSchedule,
    tableSizeWeights,
    runComposition: {
      mode: "natural-mixed-exposure",
      tableSizeSchedule: ["6max", "6max", "4max", "3way"],
      naturallyInitializedTables: true,
      deterministicSeedSchedule: true,
      targetedSampling: false,
    },
    usesSyntheticInjection: false,
    usesHiddenStateMutation: false,
    usesGameplayMutation: false,
    usesForcedOpportunityCreation: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
  };
}

export async function writeNaturalMixedExposureConfig({
  outputPath = DEFAULT_STEP45_NATURAL_EXPOSURE_CONFIG_PATH,
  ...options
} = {}) {
  return writeJsonReport(outputPath, buildNaturalMixedExposureConfig(options));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeNaturalMixedExposureConfig();
  console.log(JSON.stringify(report, null, 2));
}
