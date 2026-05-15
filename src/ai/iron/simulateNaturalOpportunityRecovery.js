import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP44_NATURAL_RECOVERY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step44-natural-opportunity-recovery.json",
);

export function summarizeNaturalOpportunityRecovery({ mixedArena = {}, repeatability = {} } = {}) {
  const s02 = (mixedArena.results ?? []).find((result) => result.variant === "S02") ?? {};
  const actions =
    Number(s02.ironActionSourceBreakdown?.["dataset-hit"] ?? 0) +
    Number(s02.ironActionSourceBreakdown?.["pro-fallback"] ?? 0);
  const repeatableMean = Number(repeatability.metrics?.exactOpportunities?.mean ?? 0);
  const zeroHitUpper95Rate = roundNumber(3 / Math.max(1, actions), 8);
  const rows = [
    {
      scenario: "more hands with observed mixed rate",
      expectedExactOpportunities: 0,
      upper95ExactOpportunitiesAt3x: roundNumber(zeroHitUpper95Rate * actions * 3, 4),
      verdict: "UNDERPOWERED_WITH_ZERO_OBSERVED_RATE",
    },
    {
      scenario: "different table-size weighting",
      expectedExactOpportunities: roundNumber(repeatableMean, 4),
      upper95ExactOpportunitiesAt3x: null,
      verdict: repeatableMean > 0 ? "RECOVERS_WITH_NATURAL_3_4_EXPOSURE" : "NO_SIGNAL",
    },
    {
      scenario: "different elimination pacing",
      expectedExactOpportunities: 0,
      upper95ExactOpportunitiesAt3x: null,
      verdict: "NEEDS_REAL_ARENA_MEASUREMENT_NO_SYNTHETIC_INJECTION",
    },
  ];
  return {
    generatedAt: new Date().toISOString(),
    target: "S02 deep RAISE-vs-CHECK",
    simulationOnly: true,
    hiddenStateInjection: false,
    syntheticOpportunityInjection: false,
    gameplayMutation: false,
    mixedS02Actions: actions,
    observedMixedExactOpportunities: 0,
    repeatableTargetedMeanExactOpportunities: repeatableMean,
    zeroHitUpper95Rate,
    rows,
    recoveryPossible: repeatableMean > 0,
    recommendedRecoveryPath: "natural table-size exposure weighting, not forced opportunity creation",
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    sourcePriorityChanged: false,
  };
}

export async function simulateNaturalOpportunityRecovery({
  mixedArenaPath = path.resolve("reports/ai-iron/iron-step43-mixed-arena.json"),
  repeatabilityPath = path.resolve("reports/ai-iron/step42-repeatability-summary.json"),
  outputPath = DEFAULT_STEP44_NATURAL_RECOVERY_OUTPUT_PATH,
  mixedArena = null,
  repeatability = null,
} = {}) {
  const report = summarizeNaturalOpportunityRecovery({
    mixedArena: mixedArena ?? (await readJson(mixedArenaPath)),
    repeatability: repeatability ?? (await readJson(repeatabilityPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await simulateNaturalOpportunityRecovery();
  console.log(JSON.stringify(report, null, 2));
}
