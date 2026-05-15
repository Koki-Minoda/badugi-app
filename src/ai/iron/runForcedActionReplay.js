import fs from "node:fs/promises";
import path from "node:path";

import { createActionHash, createReplayStateHash } from "../evaluation/replayDeterminismHash.js";
import { replayDivergenceAction } from "../evaluation/replayDivergenceAction.js";
import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import {
  average,
  callBand,
  countBy,
  loadFocusedS02Samples,
  playerCountBucket,
  sampleAxisValue,
  signFlipRate,
  stackDepth,
} from "./s02CounterfactualUtils.js";

export const DEFAULT_STEP29_FORCED_REPLAY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-lowermedium-forced-replay-step29.json",
);
export const DEFAULT_STEP29_SUBBUCKET_FORCED_REPLAY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-lowermedium-subbucket-forced-replay-step29.json",
);
export const DEFAULT_STEP29_DETERMINISM_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/s02-forced-replay-determinism-step29.json",
);

function normalizeForcedAction(action = "FOLD") {
  return { type: String(action ?? "FOLD").toUpperCase(), amount: 0, discardIndexes: [] };
}

function normalizeRolloutPolicy(policy = "pro") {
  const normalized = String(policy ?? "pro").toLowerCase();
  if (normalized === "pro-fallback") return "pro";
  return normalized;
}

function sampleId(sample = {}) {
  return [sample.variantId, sample.seed, sample.handId, sample.step, sample.actorSeat].join(":");
}

function median(values = []) {
  const list = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (!list.length) return 0;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
}

function classifyForcedSummary(summary = {}) {
  if (summary.invalidReplays > 0) return "COUNTERFACTUAL_ONLY";
  if (
    summary.sampleCount >= 30 &&
    summary.validReplays >= 30 &&
    summary.signFlipRate <= 0.1 &&
    summary.confidence >= 0.8 &&
    summary.repairRate <= 0.1 &&
    summary.meanDelta > 0
  ) {
    return "EXPORTABLE_CANDIDATE";
  }
  if (summary.sampleCount >= 10 && summary.validReplays > 0) return "COUNTERFACTUAL_ONLY";
  return "DO_NOT_TOUCH";
}

export async function runForcedActionReplay({
  sample,
  forcedActionA = "CALL",
  forcedActionB = "FOLD",
  rolloutPolicy = "pro-fallback",
  seed = 0,
  rolloutSeeds = [1],
} = {}) {
  const forcedA = normalizeForcedAction(forcedActionA);
  const forcedB = normalizeForcedAction(forcedActionB);
  const replayPolicy = normalizeRolloutPolicy(rolloutPolicy);
  const replaySeeds = rolloutSeeds?.length ? rolloutSeeds : [Number(seed) || 1];
  const base = {
    sampleId: sampleId(sample),
    forcedA: forcedA.type,
    forcedB: forcedB.type,
    rolloutPolicy,
    replayPolicy,
    seed,
    stateHash: createReplayStateHash(sample?.state ?? sample?.snapshot ?? {}),
    actionHashA: createActionHash(forcedA),
    actionHashB: createActionHash(forcedB),
  };

  const [replayA, replayB] = await Promise.all([
    replayDivergenceAction({ sample, action: forcedA, rolloutPolicy: replayPolicy, rolloutSeeds: replaySeeds }),
    replayDivergenceAction({ sample, action: forcedB, rolloutPolicy: replayPolicy, rolloutSeeds: replaySeeds }),
  ]);
  const valid = Boolean(replayA.ok && replayB.ok);
  if (!valid) {
    return {
      ...base,
      evA: replayA.ev ?? null,
      evB: replayB.ev ?? null,
      delta: null,
      winner: null,
      valid: false,
      invalidReason: replayA.invalidReason ?? replayB.invalidReason ?? replayA.errors?.[0] ?? replayB.errors?.[0] ?? "UNKNOWN",
      deterministicHash: [base.stateHash, base.actionHashA, base.actionHashB, replayA.traceHash, replayB.traceHash].filter(Boolean).join(":"),
      repairUsed: false,
      metadata: {
        legalActionsRefresh: true,
        staleActionRepair: false,
        firstActionOnlyForced: true,
      },
    };
  }
  const evA = Number(replayA.ev ?? 0);
  const evB = Number(replayB.ev ?? 0);
  const delta = evA - evB;
  return {
    ...base,
    evA: roundNumber(evA, 4),
    evB: roundNumber(evB, 4),
    delta: roundNumber(delta, 4),
    winner: delta > 0 ? "A" : delta < 0 ? "B" : "TIE",
    valid: true,
    invalidReason: null,
    deterministicHash: [base.stateHash, base.actionHashA, base.actionHashB, replayA.traceHash, replayB.traceHash].filter(Boolean).join(":"),
    repairUsed: false,
    metadata: {
      legalActionsRefresh: true,
      staleActionRepair: false,
      firstActionOnlyForced: true,
      traceHashA: replayA.traceHash ?? null,
      traceHashB: replayB.traceHash ?? null,
    },
  };
}

export function summarizeForcedReplayResults(results = []) {
  const valid = results.filter((result) => result.valid);
  const deltas = valid.map((result) => Number(result.delta ?? 0)).filter(Number.isFinite);
  const sampleCount = results.length;
  const invalidReplays = results.length - valid.length;
  const repairRate = sampleCount ? results.filter((result) => result.repairUsed).length / sampleCount : 0;
  const signFlip = signFlipRate(deltas);
  const confidence = roundNumber(Math.min(0.95, (valid.length / 40) * (1 - signFlip) * (1 - Math.min(0.5, repairRate))), 4);
  const summary = {
    sampleCount,
    validReplays: valid.length,
    invalidReplays,
    meanDelta: roundNumber(average(deltas), 4),
    medianDelta: roundNumber(median(deltas), 4),
    signFlipRate: signFlip,
    confidence,
    repairRate: roundNumber(repairRate, 4),
    deterministicReplay: invalidReplays === 0,
  };
  return {
    ...summary,
    verdict: classifyForcedSummary(summary),
  };
}

export async function runS02LowerMediumForcedReplay({
  maxSamples = 80,
  actionA = "CALL",
  actionB = "FOLD",
  rolloutPolicy = "pro-fallback",
  rolloutSeeds = [1],
  outputPath = DEFAULT_STEP29_FORCED_REPLAY_OUTPUT_PATH,
} = {}) {
  const samples = await loadFocusedS02Samples({ maxSamples });
  const results = [];
  for (const [index, sample] of samples.entries()) {
    results.push(
      await runForcedActionReplay({
        sample,
        forcedActionA: actionA,
        forcedActionB: actionB,
        rolloutPolicy,
        seed: Number(sample.seed ?? index),
        rolloutSeeds,
      }),
    );
  }
  const summary = summarizeForcedReplayResults(results);
  const report = {
    generatedAt: new Date().toISOString(),
    bucket: "S02 lowerMediumSDA5 bet-pressure",
    variant: "S02",
    actionA,
    actionB,
    rolloutPolicy,
    forcedReplayValid: summary.validReplays > 0 && summary.invalidReplays === 0,
    ...summary,
    results,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath,
  };
  await writeJsonReport(outputPath, report);
  return report;
}

function subbucketValue(sample = {}, axis = "") {
  if (axis === "playerCount") return playerCountBucket(sample);
  if (axis === "callBand") return callBand(sample);
  if (axis === "pressureFamily") return sampleAxisValue(sample, "pressureFamily");
  if (axis === "drawRound") return sampleAxisValue(sample, "drawRound");
  if (axis === "stackDepth") return stackDepth(sample);
  return sampleAxisValue(sample, axis);
}

export function buildS02SubbucketForcedReplayReport({
  samples = [],
  results = [],
  axes = ["playerCount", "callBand", "pressureFamily", "drawRound"],
  outputPath = DEFAULT_STEP29_SUBBUCKET_FORCED_REPLAY_OUTPUT_PATH,
} = {}) {
  const byId = new Map(results.map((result) => [result.sampleId, result]));
  const groups = new Map();
  for (const sample of samples) {
    const result = byId.get(sampleId(sample));
    if (!result) continue;
    for (const axis of axes) {
      const key = `${axis}=${subbucketValue(sample, axis)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(result);
    }
  }
  const subBuckets = [...groups.entries()]
    .map(([subBucket, rows]) => {
      const summary = summarizeForcedReplayResults(rows);
      return {
        subBucket,
        sample: summary.sampleCount,
        meanDelta: summary.meanDelta,
        medianDelta: summary.medianDelta,
        signFlipRate: summary.signFlipRate,
        valid: summary.validReplays,
        invalid: summary.invalidReplays,
        confidence: summary.confidence,
        verdict: summary.verdict,
      };
    })
    .sort((left, right) => {
      const rank = { EXPORTABLE_CANDIDATE: 3, COUNTERFACTUAL_ONLY: 2, DO_NOT_TOUCH: 1 };
      return (rank[right.verdict] ?? 0) - (rank[left.verdict] ?? 0) || right.sample - left.sample;
    });
  return {
    generatedAt: new Date().toISOString(),
    bucket: "S02 lowerMediumSDA5 bet-pressure",
    subBuckets,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    outputPath,
  };
}

export async function writeS02SubbucketForcedReplayReport({ samples = [], results = [], outputPath = DEFAULT_STEP29_SUBBUCKET_FORCED_REPLAY_OUTPUT_PATH } = {}) {
  const report = buildS02SubbucketForcedReplayReport({ samples, results, outputPath });
  await writeJsonReport(outputPath, report);
  return report;
}

export function buildForcedReplayDeterminismReport({
  firstRun = [],
  secondRun = [],
  outputPath = DEFAULT_STEP29_DETERMINISM_OUTPUT_PATH,
} = {}) {
  const secondById = new Map(secondRun.map((result) => [result.sampleId, result]));
  const mismatches = firstRun
    .map((left) => {
      const right = secondById.get(left.sampleId);
      if (!right) return { sampleId: left.sampleId, reason: "missing-second-run" };
      if (left.valid !== right.valid || left.evA !== right.evA || left.evB !== right.evB || left.delta !== right.delta) {
        return { sampleId: left.sampleId, reason: "ev-mismatch", left, right };
      }
      if (left.deterministicHash !== right.deterministicHash) {
        return { sampleId: left.sampleId, reason: "hash-mismatch", leftHash: left.deterministicHash, rightHash: right.deterministicHash };
      }
      return null;
    })
    .filter(Boolean);
  return {
    generatedAt: new Date().toISOString(),
    deterministic: mismatches.length === 0,
    mismatchCount: mismatches.length,
    invalidReplayCount: firstRun.filter((result) => !result.valid).length,
    mismatches,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    outputPath,
  };
}

export async function writeForcedReplayDeterminismReport({ firstRun = [], secondRun = [], outputPath = DEFAULT_STEP29_DETERMINISM_OUTPUT_PATH } = {}) {
  const report = buildForcedReplayDeterminismReport({ firstRun, secondRun, outputPath });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
