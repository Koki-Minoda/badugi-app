import fs from "node:fs/promises";
import path from "node:path";

import { clone, createControllerForVariant } from "./runAiEvaluationBatch.js";
import { replayDivergenceAction } from "./replayDivergenceAction.js";
import {
  STEP12_S02_ACCEPTED_NEIGHBOR,
  STEP12_SOURCE_TAGS,
  classifyStableNeighborContext,
  extractToCall,
  readNeighborSourceSamples,
} from "./discoverStableNeighborBuckets.js";
import { repairReplayActionLegality } from "./repairReplayActionLegality.js";

export const STEP14_S02_TARGET_BUCKET =
  "strongSDA5 CALL/FOLD/RAISE::pc=3way::pos=IP::call=small::repeat=repeated";
export const DEFAULT_STEP14_ENTROPY_OUTPUT_PATH = path.resolve(
  "reports/ai-eval/s02-v3-noise-entropy-step14.json",
);
const DEFAULT_STEP14_SOURCE_TAGS = STEP12_SOURCE_TAGS;

function round(value, digits = 4) {
  return Number(Number(value ?? 0).toFixed(digits));
}

function actionType(action = null) {
  return String(action?.type ?? action?.action ?? action ?? "").toUpperCase();
}

function normalizePositionAxis(position = "") {
  const normalized = String(position ?? "").toLowerCase();
  if (normalized.includes("button")) return "button";
  if (normalized.includes("cutoff")) return "cutoff";
  return "otherIP";
}

function normalizeToCallBandExact(toCall = 0) {
  if (toCall <= 5) return "<=5";
  if (toCall <= 10) return "6-10";
  if (toCall <= 15) return "11-15";
  return "16-20";
}

function normalizePressureChain(sample = {}) {
  const metadata = sample?.state?.snapshot?.metadata ?? {};
  const raiseCount = Number(metadata?.raiseCountThisRound ?? 0);
  const lastBettingActionType = String(metadata?.lastBettingAction?.type ?? "").toUpperCase();
  if (raiseCount >= 2) return "raise-reraise";
  if (lastBettingActionType === "CALL") return "firstRaiseAfterCall";
  if (String(sample?.facingAction ?? "").toLowerCase() === "raise") return "repeatedPressure";
  return "delayedPressure";
}

function normalizeDrawStage(drawRound = 0) {
  if (Number(drawRound ?? 0) <= 0) return "draw1";
  if (Number(drawRound ?? 0) === 1) return "draw2";
  return "postDraw";
}

function normalizeStackDepth(sample = {}) {
  const snapshot = sample?.state?.snapshot ?? sample?.snapshot ?? {};
  const actorSeat = Number(sample?.actorSeat);
  const player = snapshot?.players?.[actorSeat] ?? {};
  const stack = Number(player?.stack ?? 0);
  const bigBlind = Number(snapshot?.bigBlind ?? 20);
  const bbDepth = bigBlind > 0 ? stack / bigBlind : 0;
  if (bbDepth <= 12) return "shallow";
  if (bbDepth <= 20) return "medium";
  return "deep";
}

export function classifyS02V3IsolationAxes(sample = {}) {
  const snapshot = sample?.state?.snapshot ?? sample?.snapshot ?? {};
  const toCall = extractToCall(sample?.legalActions ?? [], snapshot, sample?.actorSeat);
  return {
    position: normalizePositionAxis(sample?.position),
    toCall: normalizeToCallBandExact(toCall),
    pressureChain: normalizePressureChain(sample),
    drawStage: normalizeDrawStage(sample?.drawRound),
    stackDepth: normalizeStackDepth(sample),
  };
}

export function computeEntropyScore({
  signFlipRate = 0,
  repairRate = 0,
  stdDev = 0,
  confidence = 0,
} = {}) {
  const boundedStd = Math.min(1, Number(stdDev ?? 0) / 200);
  const confidencePenalty = 1 - Math.min(1, Math.max(0, Number(confidence ?? 0)));
  return round(signFlipRate * 0.45 + repairRate * 0.25 + boundedStd * 0.2 + confidencePenalty * 0.1, 4);
}

export function summarizeS02OutcomeGroup(outcomes = [], { axis = null, value = null } = {}) {
  const valid = outcomes.filter((outcome) => outcome.ok);
  const deltas = valid.map((outcome) => outcome.delta);
  const sampleCount = valid.length;
  const meanDelta = sampleCount ? round(deltas.reduce((sum, delta) => sum + delta, 0) / sampleCount, 2) : 0;
  const variance = sampleCount
    ? deltas.reduce((sum, delta) => sum + (delta - meanDelta) ** 2, 0) / sampleCount
    : 0;
  const stdDev = round(Math.sqrt(Math.max(0, variance)), 2);
  const positiveRate = sampleCount ? round(valid.filter((outcome) => outcome.delta > 0).length / sampleCount, 4) : 0;
  const negativeRate = sampleCount ? round(valid.filter((outcome) => outcome.delta < 0).length / sampleCount, 4) : 0;
  const signFlipRate = round(Math.min(positiveRate, negativeRate), 4);
  const repairCount = valid.filter((outcome) => outcome.repairApplied).length;
  const repairRate = sampleCount ? round(repairCount / sampleCount, 4) : 0;
  const seedMap = new Map();
  for (const outcome of valid) {
    if (!seedMap.has(outcome.seed)) seedMap.set(outcome.seed, []);
    seedMap.get(outcome.seed).push(outcome.delta);
  }
  const stabilityAcrossSeeds = seedMap.size
    ? round(
        [...seedMap.values()].filter((values) => values.reduce((sum, delta) => sum + delta, 0) / values.length < 0).length /
          seedMap.size,
        4,
      )
    : 0;
  const confidence = round(
    Math.min(1, (sampleCount / 40) * Math.max(positiveRate, negativeRate) * Math.max(stabilityAcrossSeeds, 0.5)),
    4,
  );
  return {
    axis,
    value,
    sampleCount,
    rawSampleCount: outcomes.length,
    meanDelta,
    stdDev,
    positiveRate,
    negativeRate,
    signFlipRate,
    confidence,
    repairCount,
    repairRate,
    acceptedInvalidReplayCount: outcomes.length - sampleCount,
    replayDeterministic: outcomes.every((outcome) => outcome.deterministic !== false),
    legalityValidated: outcomes.every((outcome) => outcome.acceptedInvalidReplayCount === 0),
    entropyScore: computeEntropyScore({ signFlipRate, repairRate, stdDev, confidence }),
  };
}

export function buildS02IsolationCandidates(analysisReport = {}) {
  const base = analysisReport.baseMetrics ?? {};
  const candidates = [];
  for (const [axis, rows] of Object.entries(analysisReport.axisBreakdown ?? {})) {
    for (const row of rows) {
      let verdict = "REJECTED";
      if (row.sampleCount < 20) {
        verdict = "NEEDS_MORE_SAMPLES";
      } else if (row.acceptedInvalidReplayCount > 0) {
        verdict = "REJECTED";
      } else if (row.meanDelta >= 0) {
        verdict = "REJECTED";
      } else if (
        row.sampleCount >= 40 &&
        row.confidence >= 0.9 &&
        row.repairRate <= 0.3 &&
        row.signFlipRate <= base.signFlipRate &&
        row.entropyScore < base.entropyScore
      ) {
        verdict = "PROMISING";
      }
      candidates.push({
        axis,
        value: row.value,
        verdict,
        sampleCount: row.sampleCount,
        meanDelta: row.meanDelta,
        signFlipRate: row.signFlipRate,
        confidence: row.confidence,
        repairRate: row.repairRate,
        entropyScore: row.entropyScore,
      });
    }
  }
  return candidates.sort(
    (left, right) =>
      (left.verdict === "PROMISING" ? -1 : 1) - (right.verdict === "PROMISING" ? -1 : 1) ||
      left.entropyScore - right.entropyScore ||
      right.sampleCount - left.sampleCount,
  );
}

function createInvalidOutcome(sample = {}, reason = "UNKNOWN") {
  return {
    ok: false,
    key: [sample.variantId, sample.seed, sample.handId, sample.step, sample.actorSeat].join("|"),
    seed: sample.seed,
    handId: sample.handId,
    step: sample.step,
    actorSeat: sample.actorSeat,
    acceptedInvalidReplayCount: 1,
    deterministic: true,
    invalidReason: String(reason).toUpperCase(),
    axes: classifyS02V3IsolationAxes(sample),
  };
}

async function collectS02SampleOutcome(sample, preferredAction) {
  const proReplay = await replayDivergenceAction({
    sample,
    action: sample.proAction,
    rolloutPolicy: "pro",
    rolloutSeeds: [1],
  });

  let chosenAction = preferredAction;
  let repairApplied = false;
  let repairType = null;
  let expandedReplay = await replayDivergenceAction({
    sample,
    action: chosenAction,
    rolloutPolicy: "pro",
    rolloutSeeds: [1],
  });

  if (!expandedReplay.ok && chosenAction) {
    const controller = createControllerForVariant(
      sample.variantId,
      Array.isArray(sample?.state?.snapshot?.players) ? sample.state.snapshot.players.length : 6,
    );
    const repair = repairReplayActionLegality({
      controller,
      state: clone(sample.state),
      actorSeat: sample.actorSeat,
      action: chosenAction,
      replayResult: expandedReplay,
      sample,
    });
    if (repair.ok && repair.repairedAction) {
      const repairedReplay = await replayDivergenceAction({
        sample,
        action: repair.repairedAction,
        rolloutPolicy: "pro",
        rolloutSeeds: [1],
      });
      if (repairedReplay.ok) {
        expandedReplay = repairedReplay;
        chosenAction = repair.repairedAction;
        repairApplied = true;
        repairType = repair.repairType;
      } else {
        return createInvalidOutcome(sample, repair.invalidReason ?? repairedReplay.invalidReason ?? "UNKNOWN");
      }
    } else {
      return createInvalidOutcome(sample, repair.invalidReason ?? expandedReplay.invalidReason ?? "UNKNOWN");
    }
  }

  if (!proReplay.ok || !expandedReplay.ok) {
    return createInvalidOutcome(sample, proReplay.invalidReason ?? expandedReplay.invalidReason ?? "UNKNOWN");
  }

  return {
    ok: true,
    key: [sample.variantId, sample.seed, sample.handId, sample.step, sample.actorSeat].join("|"),
    seed: sample.seed,
    handId: sample.handId,
    step: sample.step,
    actorSeat: sample.actorSeat,
    delta: round(Number(proReplay.ev ?? 0) - Number(expandedReplay.ev ?? 0), 2),
    proEv: Number(proReplay.ev ?? 0),
    stdEv: Number(expandedReplay.ev ?? 0),
    repairApplied,
    repairType,
    chosenAction,
    acceptedInvalidReplayCount: 0,
    deterministic: true,
    axes: classifyS02V3IsolationAxes(sample),
  };
}

export async function analyzeS02V3NoiseEntropy({
  sourceTags = DEFAULT_STEP14_SOURCE_TAGS,
  maxSamples = 16000,
  outputPath = DEFAULT_STEP14_ENTROPY_OUTPUT_PATH,
  parentAction = { type: "RAISE", amount: 0, discardIndexes: [] },
} = {}) {
  const sourceSamples = await readNeighborSourceSamples({ variants: ["S02"], sourceTags });
  const matchingSamples = sourceSamples
    .filter((sample) => {
      const classified = classifyStableNeighborContext(sample);
      return classified && classified.subBucketId === STEP14_S02_TARGET_BUCKET;
    })
    .slice(0, Math.max(120, Math.min(Number(maxSamples ?? 16000), 180)));

  const outcomes = [];
  for (const sample of matchingSamples) {
    outcomes.push(await collectS02SampleOutcome(sample, parentAction));
  }

  const baseMetrics = summarizeS02OutcomeGroup(outcomes, {
    axis: "bucket",
    value: STEP14_S02_TARGET_BUCKET,
  });

  const axisBreakdown = {
    position: [],
    toCall: [],
    pressureChain: [],
    drawStage: [],
    stackDepth: [],
  };

  for (const axis of Object.keys(axisBreakdown)) {
    const groups = new Map();
    for (const outcome of outcomes) {
      const value = String(outcome.axes?.[axis] ?? "unknown");
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(outcome);
    }
    axisBreakdown[axis] = [...groups.entries()]
      .map(([value, groupOutcomes]) => summarizeS02OutcomeGroup(groupOutcomes, { axis, value }))
      .sort((left, right) => right.sampleCount - left.sampleCount || left.value.localeCompare(right.value));
  }

  const report = {
    createdAt: new Date().toISOString(),
    targetBucket: STEP14_S02_TARGET_BUCKET,
    parentStableBucket: STEP12_S02_ACCEPTED_NEIGHBOR,
    sourceTags,
    baseMetrics,
    axisBreakdown,
    isolationCandidates: buildS02IsolationCandidates({ baseMetrics, axisBreakdown }),
    sampleOutcomes: outcomes.map((outcome) => ({
      key: outcome.key,
      seed: outcome.seed,
      handId: outcome.handId,
      step: outcome.step,
      actorSeat: outcome.actorSeat,
      ok: outcome.ok,
      delta: outcome.delta ?? null,
      repairApplied: Boolean(outcome.repairApplied),
      repairType: outcome.repairType ?? null,
      chosenAction: outcome.chosenAction ?? null,
      axes: outcome.axes,
      invalidReason: outcome.invalidReason ?? null,
    })),
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return { outputPath, report };
}
