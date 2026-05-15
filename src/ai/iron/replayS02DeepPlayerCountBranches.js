import path from "node:path";

import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { runForcedActionReplay, summarizeForcedReplayResults } from "./runForcedActionReplay.js";
import {
  STEP37_TARGET_PLAYER_COUNTS,
  loadS02DeepPlayerCountReplaySamples,
} from "./acquireS02DeepPlayerCountReplay.js";
import { actionName } from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP37_PLAYERCOUNT_FORCED_REPLAY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-deep-playercount-forced-replay-step37.json",
);

function sampleMeta(sample = {}) {
  return {
    variantId: sample.variantId ?? null,
    seed: sample.seed ?? null,
    handId: sample.handId ?? null,
    step: sample.step ?? null,
    actorSeat: sample.actorSeat ?? null,
    stackDepth: "deep",
    actionPair: `${actionName(sample.standardAction)} vs ${actionName(sample.proAction)}`,
    standardAction: actionName(sample.standardAction),
    proAction: actionName(sample.proAction),
    playerCount: Number(sample.playerCount ?? 0),
    handClass: sample.handClass ?? "unknown",
    position: sample.position ?? "unknown",
    pressureFamily: sample.facingAction === "bet" ? "bet-pressure" : `${sample.facingAction ?? "none"}-pressure`,
    drawRound: `draw-${sample.drawRound ?? "unknown"}`,
    callBand: sample.drawRound >= 1 ? "big" : "small",
    sampleTag: sample.sampleTag ?? null,
    sampleFile: sample.sampleFile ?? null,
  };
}

function summarizeBranch(playerCount, results = []) {
  const summary = summarizeForcedReplayResults(results);
  return {
    playerCount: Number(playerCount),
    sampleCount: summary.sampleCount,
    validReplayCount: summary.validReplays,
    invalidReplayCount: summary.invalidReplays,
    meanDelta: summary.meanDelta,
    medianDelta: summary.medianDelta,
    signFlipRate: summary.signFlipRate,
    confidence: summary.confidence,
    repairRate: summary.repairRate,
    deterministicReplay: summary.deterministicReplay,
    actionA: "RAISE",
    actionB: "CHECK",
    results,
  };
}

export async function replayS02DeepPlayerCountBranches({
  targetPerBranch = 50,
  sampleGroups = null,
  rolloutSeeds = [1],
  rolloutPolicy = "pro-fallback",
  outputPath = DEFAULT_STEP37_PLAYERCOUNT_FORCED_REPLAY_OUTPUT_PATH,
} = {}) {
  const groups = sampleGroups ?? (await loadS02DeepPlayerCountReplaySamples({ targetPerBranch }));
  const branches = [];
  for (const playerCount of STEP37_TARGET_PLAYER_COUNTS) {
    const samples = groups[String(playerCount)] ?? [];
    const results = [];
    for (const [index, sample] of samples.entries()) {
      const result = await runForcedActionReplay({
        sample,
        forcedActionA: "RAISE",
        forcedActionB: "CHECK",
        rolloutPolicy,
        seed: Number(sample.seed ?? index),
        rolloutSeeds,
      });
      results.push({ ...result, sampleMeta: sampleMeta(sample) });
    }
    branches.push(summarizeBranch(playerCount, results));
  }
  const allResults = branches.flatMap((branch) => branch.results);
  const aggregate = summarizeForcedReplayResults(allResults);
  return writeJsonReport(outputPath, {
    generatedAt: new Date().toISOString(),
    variant: "S02",
    target: "deep RAISE vs CHECK playerCount branches",
    rolloutPolicy,
    targetPerBranch,
    branches,
    aggregate: {
      sampleCount: aggregate.sampleCount,
      validReplayCount: aggregate.validReplays,
      invalidReplayCount: aggregate.invalidReplays,
      meanDelta: aggregate.meanDelta,
      medianDelta: aggregate.medianDelta,
      signFlipRate: aggregate.signFlipRate,
      confidence: aggregate.confidence,
      repairRate: aggregate.repairRate,
      deterministicReplay: aggregate.deterministicReplay,
    },
    deterministicReplay: allResults.every((result) => result.valid),
    invalidReplayCount: allResults.filter((result) => !result.valid).length,
    repairRate: roundNumber(allResults.length ? allResults.filter((result) => result.repairUsed).length / allResults.length : 0, 4),
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath,
  });
}
