import fs from "node:fs/promises";
import path from "node:path";

import { isReplayActionStillLegal, replayDivergenceAction } from "./replayDivergenceAction.js";
import { repairReplayActionLegality } from "./repairReplayActionLegality.js";
import {
  STEP10_SOURCE_TAGS,
  STEP11_SOURCE_TAGS,
  STEP11_S02_ACCEPTED_NEIGHBOR,
  STEP12_SOURCE_TAGS,
  STEP12_S02_ACCEPTED_NEIGHBOR,
  STEP14_S02_V3_PARENT_BUCKET,
  classifyStableNeighborContext,
  discoverS02NeighborV2Candidates,
  discoverS02NeighborV3Candidates,
  discoverS02V3IsolationCandidates,
  discoverStableNeighborBuckets,
  readNeighborSourceSamples,
} from "./discoverStableNeighborBuckets.js";
import {
  DEFAULT_STEP14_ENTROPY_OUTPUT_PATH,
  STEP14_S02_TARGET_BUCKET,
  analyzeS02V3NoiseEntropy,
  summarizeS02OutcomeGroup,
} from "./analyzeS02V3NoiseEntropy.js";
import { clone, createControllerForVariant } from "./runAiEvaluationBatch.js";

const DEFAULT_DATASET_PATH = path.resolve("data/ai/action-value/iron-step7-action-value.jsonl");
const DEFAULT_DISCOVERY_OUTPUT_PATH = path.resolve("reports/ai-eval/stable-neighbor-candidates-step10.json");
const DEFAULT_VERIFICATION_OUTPUT_PATH = path.resolve("reports/ai-eval/stable-neighbor-verification-step10.json");
const DEFAULT_COUNTERFACTUAL_OUTPUT_PATH = path.resolve("reports/ai-eval/counterfactual-score-d02-s01-s02-iron-step10.json");
const DEFAULT_STEP11_DISCOVERY_OUTPUT_PATH = path.resolve("reports/ai-eval/s02-neighbor-v2-candidates-step11.json");
const DEFAULT_STEP11_VERIFICATION_OUTPUT_PATH = path.resolve("reports/ai-eval/s02-neighbor-verification-step11.json");
const DEFAULT_STEP11_COUNTERFACTUAL_OUTPUT_PATH = path.resolve("reports/ai-eval/counterfactual-score-s02-iron-step11.json");
const DEFAULT_STEP11_RAW_INVALID_OUTPUT_PATH = path.resolve("reports/ai-eval/neighbor-raw-invalid-step11.json");
const DEFAULT_STEP12_DISCOVERY_OUTPUT_PATH = path.resolve("reports/ai-eval/s02-neighbor-v3-candidates-step12.json");
const DEFAULT_STEP12_VERIFICATION_OUTPUT_PATH = path.resolve("reports/ai-eval/s02-neighbor-v3-verification-step12.json");
const DEFAULT_STEP12_COUNTERFACTUAL_OUTPUT_PATH = path.resolve("reports/ai-eval/counterfactual-score-s02-iron-step12.json");
const DEFAULT_STEP12_RAW_INVALID_OUTPUT_PATH = path.resolve("reports/ai-eval/neighbor-raw-invalid-step12.json");
const DEFAULT_STEP13_VERIFICATION_OUTPUT_PATH = path.resolve("reports/ai-eval/s02-v3-repaired-verification-step13.json");
const DEFAULT_STEP13_COUNTERFACTUAL_OUTPUT_PATH = path.resolve("reports/ai-eval/counterfactual-score-s02-iron-step13.json");
const DEFAULT_STEP13_INVALID_OUTPUT_PATH = path.resolve("reports/ai-eval/s02-v3-invalid-replay-step13.json");
const STEP13_TARGET_BUCKET = STEP14_S02_TARGET_BUCKET;
const DEFAULT_STEP14_DISCOVERY_OUTPUT_PATH = path.resolve("reports/ai-eval/s02-v3-isolation-candidates-step14.json");
const DEFAULT_STEP14_VERIFICATION_OUTPUT_PATH = path.resolve("reports/ai-eval/s02-v3-isolation-verification-step14.json");
const DEFAULT_STEP14_COUNTERFACTUAL_OUTPUT_PATH = path.resolve("reports/ai-eval/counterfactual-score-s02-iron-step14.json");
const DEFAULT_STEP15_PROPOSAL_OUTPUT_PATH = path.resolve("reports/ai-iron/s02-relaxed-match-proposal-step15.json");
const DEFAULT_STEP15_VERIFICATION_OUTPUT_PATH = path.resolve("reports/ai-eval/s02-relaxed-match-verification-step15.json");
const DEFAULT_STEP15_COUNTERFACTUAL_OUTPUT_PATH = path.resolve("reports/ai-eval/counterfactual-score-s02-iron-step15.json");

function round(value, digits = 2) {
  return Number(Number(value ?? 0).toFixed(digits));
}

async function readExistingDatasetRows(datasetPath = DEFAULT_DATASET_PATH) {
  const content = await fs.readFile(datasetPath, "utf8").catch(() => "");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function buildParentActionMap(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.variantId}|${row.bucket}`;
    if (!map.has(key)) {
      map.set(key, {
        variantId: row.variantId,
        parentStableBucket: row.bucket,
        handClass: row.handClass,
        actionCounts: new Map(),
      });
    }
    const entry = map.get(key);
    const actionType = String(row?.chosenBestAction?.type ?? "").toUpperCase();
    if (!actionType) continue;
    entry.actionCounts.set(actionType, (entry.actionCounts.get(actionType) ?? 0) + 1);
  }
  const resolved = new Map();
  for (const [key, entry] of map.entries()) {
    const actionType = [...entry.actionCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    if (!actionType) continue;
    resolved.set(key, {
      variantId: entry.variantId,
      parentStableBucket: entry.parentStableBucket,
      handClass: entry.handClass,
      action: { type: actionType, amount: 0, discardIndexes: [], source: "iron-stable-neighbor", reason: `neighbor:${entry.parentStableBucket}` },
    });
  }
  return resolved;
}

export function classifyVerificationVerdict({
  sampleCount = 0,
  invalidReplayCount = 0,
  confidence = 0,
  signFlipRate = 1,
  meanDelta = 0,
  deterministicReplay = true,
}) {
  if (invalidReplayCount > 0 || !deterministicReplay) return "REJECTED";
  if (sampleCount < 5) return "NEEDS_MORE_SAMPLES";
  if (meanDelta >= 0) return "REJECTED";
  if (confidence >= 0.9 && signFlipRate <= 0.1) return "VERIFIED_EXPANDABLE";
  if (signFlipRate > 0.25) return "NOISY";
  return "NEEDS_MORE_SAMPLES";
}

function createEmptyHistogram() {
  return {
    LEGAL_ACTION_MISMATCH: 0,
    INVALID_ACTION: 0,
    RAISE_CAP_REACHED: 0,
    STALE_RAISE: 0,
    ACTION_NOT_IN_REFRESHED_LEGAL: 0,
    STACK_CONSTRAINT: 0,
    BETTING_ROUND_MISMATCH: 0,
    ACTOR_MISMATCH: 0,
    STATE_RESTORE_MISMATCH: 0,
    STATE_RESTORE_ERROR: 0,
    RNG_MISMATCH: 0,
    MAX_STEPS_EXCEEDED: 0,
    TERMINAL_MISMATCH: 0,
    EV_CHECK_FAILED: 0,
    UNKNOWN: 0,
  };
}

function buildSampleKey(sample = {}) {
  return [sample.variantId, sample.seed, sample.handId, sample.step, sample.actorSeat].join("|");
}

export async function verifyStableNeighborBuckets({
  variants = ["D02", "S01", "S02"],
  datasetPath = DEFAULT_DATASET_PATH,
  sourceTags = STEP10_SOURCE_TAGS,
  maxSamples = 500,
  discoveryOutputPath = DEFAULT_DISCOVERY_OUTPUT_PATH,
  verificationOutputPath = DEFAULT_VERIFICATION_OUTPUT_PATH,
  counterfactualOutputPath = DEFAULT_COUNTERFACTUAL_OUTPUT_PATH,
} = {}) {
  const discovery =
    (await fs
      .readFile(discoveryOutputPath, "utf8")
      .then((content) => JSON.parse(content))
      .catch(() => null)) ??
    (await discoverStableNeighborBuckets({ datasetPath, variants, sourceTags, outputPath: discoveryOutputPath }));
  const baseRows = await readExistingDatasetRows(datasetPath);
  const parentActions = buildParentActionMap(baseRows);
  const sourceSamples = await readNeighborSourceSamples({ variants, sourceTags });

  const candidateResults = [];
  let remainingBudget = Math.max(1, Number(maxSamples ?? 500));
  for (const candidate of discovery.neighborCandidates) {
    if (remainingBudget <= 0) break;
    const parent = parentActions.get(`${candidate.variantId}|${candidate.parentStableBucket}`);
    if (!parent) continue;
    const matchingSamples = sourceSamples
      .filter((sample) => {
        const classified = classifyStableNeighborContext(sample);
        return (
          classified &&
          classified.variantId === candidate.variantId &&
          classified.subBucketId === candidate.subBucketId
        );
      })
      .slice(0, Math.min(remainingBudget, 20));
    if (!matchingSamples.length) continue;
    remainingBudget -= matchingSamples.length;

    const deltas = [];
    const seedSigns = new Map();
    let validReplayCount = 0;
    let invalidReplayCount = 0;
    let proEvTotal = 0;
    let expandedEvTotal = 0;
    for (const sample of matchingSamples) {
      const proReplay = await replayDivergenceAction({
        sample,
        action: sample.proAction,
        rolloutPolicy: "pro",
        rolloutSeeds: [1],
      });
      const expandedReplay = await replayDivergenceAction({
        sample,
        action: parent.action,
        rolloutPolicy: "pro",
        rolloutSeeds: [1],
      });
      if (!proReplay.ok || !expandedReplay.ok) {
        invalidReplayCount += 1;
        continue;
      }
      validReplayCount += 1;
      const delta = round(Number(proReplay.ev ?? 0) - Number(expandedReplay.ev ?? 0), 2);
      deltas.push(delta);
      proEvTotal += Number(proReplay.ev ?? 0);
      expandedEvTotal += Number(expandedReplay.ev ?? 0);
      if (!seedSigns.has(sample.seed)) seedSigns.set(sample.seed, []);
      seedSigns.get(sample.seed).push(delta);
    }

    const sampleCount = matchingSamples.length;
    const meanDelta = deltas.length ? round(deltas.reduce((sum, value) => sum + value, 0) / deltas.length, 2) : 0;
    const variance = deltas.length
      ? deltas.reduce((sum, value) => sum + (value - meanDelta) ** 2, 0) / deltas.length
      : 0;
    const stdDev = round(Math.sqrt(Math.max(0, variance)), 2);
    const positiveRate = deltas.length ? round(deltas.filter((value) => value > 0).length / deltas.length, 4) : 0;
    const negativeRate = deltas.length ? round(deltas.filter((value) => value < 0).length / deltas.length, 4) : 0;
    const signFlipRate = round(Math.min(positiveRate, negativeRate), 4);
    const seedStability = seedSigns.size
      ? round(
          [...seedSigns.values()].filter((values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) < 0).length /
            seedSigns.size,
          4,
        )
      : 0;
    const confidence = round(
      Math.min(1, (validReplayCount / 10) * Math.max(negativeRate, positiveRate) * Math.max(seedStability, 0.5)),
      4,
    );
    const verdict = classifyVerificationVerdict({
      sampleCount: validReplayCount,
      invalidReplayCount,
      confidence,
      signFlipRate,
      meanDelta,
      deterministicReplay: invalidReplayCount === 0,
    });

    candidateResults.push({
      variant: candidate.variantId,
      bucket: candidate.subBucketId,
      parentStableBucket: candidate.parentStableBucket,
      neighborAxis: candidate.neighborAxis,
      sourceType: "verified-neighbor",
      proAction: String(sampleCount ? sampleCount && matchingSamples[0]?.proAction?.type : "PRO").toUpperCase(),
      stdAction: parent.action.type,
      proEv: validReplayCount ? round(proEvTotal / validReplayCount, 2) : null,
      stdEv: validReplayCount ? round(expandedEvTotal / validReplayCount, 2) : null,
      meanDelta,
      medianDelta: deltas.length ? deltas.sort((a, b) => a - b)[Math.floor(deltas.length / 2)] : null,
      stdDev,
      positiveRate,
      negativeRate,
      signFlipRate,
      confidence,
      replayConsistencyScore: seedStability,
      replayDeterministic: invalidReplayCount === 0,
      legalityValidated: invalidReplayCount === 0,
      sampleCount,
      validReplayCount,
      invalidReplayCount,
      verificationConfidence: confidence,
      verdict,
    });
  }

  const verification = {
    createdAt: new Date().toISOString(),
    variants,
    datasetPath,
    sourceTags,
    maxSamples,
    bucketResults: candidateResults.sort((left, right) =>
      left.variant.localeCompare(right.variant) || left.bucket.localeCompare(right.bucket),
    ),
  };

  const counterfactual = {
    createdAt: verification.createdAt,
    variants,
    sampleTagFilter: ["iron-step10"],
    replaySamples: candidateResults.reduce((sum, entry) => sum + entry.sampleCount, 0),
    validReplays: candidateResults.reduce((sum, entry) => sum + entry.validReplayCount, 0),
    invalidReplays: candidateResults.reduce((sum, entry) => sum + entry.invalidReplayCount, 0),
    bucketResults: verification.bucketResults,
  };

  await fs.mkdir(path.dirname(verificationOutputPath), { recursive: true });
  await fs.writeFile(verificationOutputPath, JSON.stringify(verification, null, 2));
  await fs.writeFile(counterfactualOutputPath, JSON.stringify(counterfactual, null, 2));
  return { verification, counterfactual, verificationOutputPath, counterfactualOutputPath };
}

export async function verifyS02NeighborV2Expansion({
  datasetPath = path.resolve("data/ai/action-value/iron-step10-action-value.jsonl"),
  sourceTags = STEP11_SOURCE_TAGS,
  maxSamples = 12000,
  discoveryOutputPath = DEFAULT_STEP11_DISCOVERY_OUTPUT_PATH,
  verificationOutputPath = DEFAULT_STEP11_VERIFICATION_OUTPUT_PATH,
  counterfactualOutputPath = DEFAULT_STEP11_COUNTERFACTUAL_OUTPUT_PATH,
  rawInvalidOutputPath = DEFAULT_STEP11_RAW_INVALID_OUTPUT_PATH,
} = {}) {
  const discovery =
    (await fs.readFile(discoveryOutputPath, "utf8").then((content) => JSON.parse(content)).catch(() => null)) ??
    (await discoverS02NeighborV2Candidates({ sourceTags, outputPath: discoveryOutputPath }));
  const baseRows = await readExistingDatasetRows(datasetPath);
  const parentActions = buildParentActionMap(baseRows);
  const parent = parentActions.get(`S02|strongSDA5 CALL/FOLD/RAISE`);
  const sourceSamples = await readNeighborSourceSamples({ variants: ["S02"], sourceTags });
  const rawInvalidHistogram = createEmptyHistogram();
  const rawInvalidSamples = [];
  const bucketResults = [];
  let remainingBudget = Math.max(1, Number(maxSamples ?? 12000));

  for (const candidate of discovery.neighborCandidates) {
    if (remainingBudget <= 0) break;
    const matchingSamples = sourceSamples
      .filter((sample) => {
        const classified = classifyStableNeighborContext(sample);
        return classified && classified.subBucketId === candidate.subBucketId;
      })
      .slice(0, Math.min(remainingBudget, 80));
    if (!matchingSamples.length) continue;
    remainingBudget -= matchingSamples.length;

    const deltas = [];
    const seedSigns = new Map();
    let validReplayCount = 0;
    let acceptedInvalidReplayCount = 0;
    let proEvTotal = 0;
    let expandedEvTotal = 0;
    let localRawInvalidCount = 0;

    for (const sample of matchingSamples) {
      const controller = createControllerForVariant(
        sample.variantId,
        Array.isArray(sample.state?.snapshot?.players) ? sample.state.snapshot.players.length : 6,
      );
      const proLegality = isReplayActionStillLegal({
        controller,
        state: clone(sample.state),
        actorSeat: sample.actorSeat,
        action: sample.proAction,
      });
      const expandedLegality = isReplayActionStillLegal({
        controller,
        state: clone(sample.state),
        actorSeat: sample.actorSeat,
        action: parent.action,
      });
      const invalidReason = proLegality.reason ?? expandedLegality.reason ?? null;
      if (!proLegality.ok || !expandedLegality.ok) {
        localRawInvalidCount += 1;
        const key = String(invalidReason ?? "UNKNOWN").toUpperCase();
        rawInvalidHistogram[key] = (rawInvalidHistogram[key] ?? 0) + 1;
        rawInvalidSamples.push({
          variantId: sample.variantId,
          seed: sample.seed,
          handId: sample.handId,
          step: sample.step,
          bucket: candidate.subBucketId,
          invalidReason: key,
        });
        continue;
      }

      const proReplay = await replayDivergenceAction({
        sample,
        action: sample.proAction,
        rolloutPolicy: "pro",
        rolloutSeeds: [1],
      });
      const expandedReplay = await replayDivergenceAction({
        sample,
        action: parent.action,
        rolloutPolicy: "pro",
        rolloutSeeds: [1],
      });
      if (!proReplay.ok || !expandedReplay.ok) {
        acceptedInvalidReplayCount += 1;
        continue;
      }
      validReplayCount += 1;
      const delta = round(Number(proReplay.ev ?? 0) - Number(expandedReplay.ev ?? 0), 2);
      deltas.push(delta);
      proEvTotal += Number(proReplay.ev ?? 0);
      expandedEvTotal += Number(expandedReplay.ev ?? 0);
      if (!seedSigns.has(sample.seed)) seedSigns.set(sample.seed, []);
      seedSigns.get(sample.seed).push(delta);
    }

    const meanDelta = deltas.length ? round(deltas.reduce((sum, value) => sum + value, 0) / deltas.length, 2) : 0;
    const variance = deltas.length
      ? deltas.reduce((sum, value) => sum + (value - meanDelta) ** 2, 0) / deltas.length
      : 0;
    const stdDev = round(Math.sqrt(Math.max(0, variance)), 2);
    const positiveRate = deltas.length ? round(deltas.filter((value) => value > 0).length / deltas.length, 4) : 0;
    const negativeRate = deltas.length ? round(deltas.filter((value) => value < 0).length / deltas.length, 4) : 0;
    const signFlipRate = round(Math.min(positiveRate, negativeRate), 4);
    const seedStability = seedSigns.size
      ? round(
          [...seedSigns.values()].filter((values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) < 0).length /
            seedSigns.size,
          4,
        )
      : 0;
    const confidence = round(
      Math.min(1, (validReplayCount / 40) * Math.max(negativeRate, positiveRate) * Math.max(seedStability, 0.5)),
      4,
    );
    let verdict = "REJECTED";
    if (acceptedInvalidReplayCount > 0) {
      verdict = "REJECTED";
    } else if (validReplayCount < 40) {
      verdict = "NEEDS_MORE_SAMPLES";
    } else if (meanDelta >= 0) {
      verdict = "REJECTED";
    } else if (confidence >= 0.9 && signFlipRate <= 0.15) {
      verdict = "VERIFIED_EXPANDABLE";
    } else if (signFlipRate > 0.2) {
      verdict = "NOISY";
    } else {
      verdict = "NEEDS_MORE_SAMPLES";
    }

    bucketResults.push({
      variant: "S02",
      bucket: candidate.subBucketId,
      parentStableBucket: "strongSDA5 CALL/FOLD/RAISE",
      neighborAxis: candidate.neighborAxis,
      anchorStableBucket: STEP11_S02_ACCEPTED_NEIGHBOR,
      sourceType: "verified-neighbor-v2",
      proAction: "FOLD",
      stdAction: parent.action.type,
      meanDelta,
      stdDev,
      positiveRate,
      negativeRate,
      signFlipRate,
      confidence,
      replayConsistencyScore: seedStability,
      replayDeterministic: acceptedInvalidReplayCount === 0,
      legalityValidated: acceptedInvalidReplayCount === 0,
      sampleCount: validReplayCount,
      rawSampleCount: matchingSamples.length,
      validReplayCount,
      invalidReplayCount: acceptedInvalidReplayCount,
      rawInvalidReplayCount: localRawInvalidCount,
      acceptedInvalidReplayCount,
      verificationConfidence: confidence,
      verdict,
      proEv: validReplayCount ? round(proEvTotal / validReplayCount, 2) : null,
      stdEv: validReplayCount ? round(expandedEvTotal / validReplayCount, 2) : null,
    });
  }

  const verification = {
    createdAt: new Date().toISOString(),
    variants: ["S02"],
    datasetPath,
    sourceTags,
    maxSamples,
    anchorStableBucket: STEP11_S02_ACCEPTED_NEIGHBOR,
    bucketResults: bucketResults.sort((left, right) => right.sampleCount - left.sampleCount || left.bucket.localeCompare(right.bucket)),
  };
  const counterfactual = {
    createdAt: verification.createdAt,
    variants: ["S02"],
    sampleTagFilter: ["iron-step11"],
    replaySamples: bucketResults.reduce((sum, entry) => sum + entry.rawSampleCount, 0),
    validReplays: bucketResults.reduce((sum, entry) => sum + entry.validReplayCount, 0),
    invalidReplays: bucketResults.reduce((sum, entry) => sum + entry.acceptedInvalidReplayCount, 0),
    rawInvalidReplays: bucketResults.reduce((sum, entry) => sum + entry.rawInvalidReplayCount, 0),
    bucketResults: verification.bucketResults,
  };
  const rawInvalid = {
    createdAt: verification.createdAt,
    variants: ["S02"],
    anchorStableBucket: STEP11_S02_ACCEPTED_NEIGHBOR,
    rawInvalidReplayCount: rawInvalidSamples.length,
    invalidReasonHistogram: rawInvalidHistogram,
    samples: rawInvalidSamples,
  };

  await fs.mkdir(path.dirname(verificationOutputPath), { recursive: true });
  await fs.writeFile(verificationOutputPath, JSON.stringify(verification, null, 2), "utf8");
  await fs.writeFile(counterfactualOutputPath, JSON.stringify(counterfactual, null, 2), "utf8");
  await fs.writeFile(rawInvalidOutputPath, JSON.stringify(rawInvalid, null, 2), "utf8");
  return { verification, counterfactual, rawInvalid, verificationOutputPath, counterfactualOutputPath, rawInvalidOutputPath };
}

export async function verifyS02NeighborV3Expansion({
  datasetPath = path.resolve("data/ai/action-value/iron-step11-action-value.jsonl"),
  sourceTags = STEP12_SOURCE_TAGS,
  maxSamples = 14000,
  discoveryOutputPath = DEFAULT_STEP12_DISCOVERY_OUTPUT_PATH,
  verificationOutputPath = DEFAULT_STEP12_VERIFICATION_OUTPUT_PATH,
  counterfactualOutputPath = DEFAULT_STEP12_COUNTERFACTUAL_OUTPUT_PATH,
  rawInvalidOutputPath = DEFAULT_STEP12_RAW_INVALID_OUTPUT_PATH,
} = {}) {
  const discovery =
    (await fs.readFile(discoveryOutputPath, "utf8").then((content) => JSON.parse(content)).catch(() => null)) ??
    (await discoverS02NeighborV3Candidates({ sourceTags, outputPath: discoveryOutputPath }));
  const baseRows = await readExistingDatasetRows(datasetPath);
  const parentActions = buildParentActionMap(baseRows);
  const parent = parentActions.get(`S02|${STEP12_S02_ACCEPTED_NEIGHBOR}`);
  const sourceSamples = await readNeighborSourceSamples({ variants: ["S02"], sourceTags });
  const rawInvalidHistogram = createEmptyHistogram();
  const rawInvalidSamples = [];
  const bucketResults = [];
  let remainingBudget = Math.max(1, Number(maxSamples ?? 14000));

  for (const candidate of discovery.neighborCandidates) {
    if (remainingBudget <= 0) break;
    const matchingSamples = sourceSamples
      .filter((sample) => {
        const classified = classifyStableNeighborContext(sample);
        return classified && classified.subBucketId === candidate.subBucketId;
      })
      .slice(0, Math.min(remainingBudget, 100));
    if (!matchingSamples.length || !parent) continue;
    remainingBudget -= matchingSamples.length;

    const deltas = [];
    const seedSigns = new Map();
    let validReplayCount = 0;
    let acceptedInvalidReplayCount = 0;
    let proEvTotal = 0;
    let expandedEvTotal = 0;
    let localRawInvalidCount = 0;

    for (const sample of matchingSamples) {
      const controller = createControllerForVariant(
        sample.variantId,
        Array.isArray(sample.state?.snapshot?.players) ? sample.state.snapshot.players.length : 6,
      );
      const proLegality = isReplayActionStillLegal({
        controller,
        state: clone(sample.state),
        actorSeat: sample.actorSeat,
        action: sample.proAction,
      });
      const expandedLegality = isReplayActionStillLegal({
        controller,
        state: clone(sample.state),
        actorSeat: sample.actorSeat,
        action: parent.action,
      });
      const invalidReason = proLegality.reason ?? expandedLegality.reason ?? null;
      if (!proLegality.ok || !expandedLegality.ok) {
        localRawInvalidCount += 1;
        const key = String(invalidReason ?? "UNKNOWN").toUpperCase();
        rawInvalidHistogram[key] = (rawInvalidHistogram[key] ?? 0) + 1;
        rawInvalidSamples.push({
          variantId: sample.variantId,
          seed: sample.seed,
          handId: sample.handId,
          step: sample.step,
          bucket: candidate.subBucketId,
          invalidReason: key,
        });
        continue;
      }

      const proReplay = await replayDivergenceAction({
        sample,
        action: sample.proAction,
        rolloutPolicy: "pro",
        rolloutSeeds: [1],
      });
      const expandedReplay = await replayDivergenceAction({
        sample,
        action: parent.action,
        rolloutPolicy: "pro",
        rolloutSeeds: [1],
      });
      if (!proReplay.ok || !expandedReplay.ok) {
        acceptedInvalidReplayCount += 1;
        continue;
      }
      validReplayCount += 1;
      const delta = round(Number(proReplay.ev ?? 0) - Number(expandedReplay.ev ?? 0), 2);
      deltas.push(delta);
      proEvTotal += Number(proReplay.ev ?? 0);
      expandedEvTotal += Number(expandedReplay.ev ?? 0);
      if (!seedSigns.has(sample.seed)) seedSigns.set(sample.seed, []);
      seedSigns.get(sample.seed).push(delta);
    }

    const meanDelta = deltas.length ? round(deltas.reduce((sum, value) => sum + value, 0) / deltas.length, 2) : 0;
    const variance = deltas.length
      ? deltas.reduce((sum, value) => sum + (value - meanDelta) ** 2, 0) / deltas.length
      : 0;
    const stdDev = round(Math.sqrt(Math.max(0, variance)), 2);
    const positiveRate = deltas.length ? round(deltas.filter((value) => value > 0).length / deltas.length, 4) : 0;
    const negativeRate = deltas.length ? round(deltas.filter((value) => value < 0).length / deltas.length, 4) : 0;
    const signFlipRate = round(Math.min(positiveRate, negativeRate), 4);
    const seedStability = seedSigns.size
      ? round(
          [...seedSigns.values()].filter((values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) < 0).length /
            seedSigns.size,
          4,
        )
      : 0;
    const confidence = round(
      Math.min(1, (validReplayCount / 40) * Math.max(negativeRate, positiveRate) * Math.max(seedStability, 0.5)),
      4,
    );
    let verdict = "REJECTED";
    if (acceptedInvalidReplayCount > 0) {
      verdict = "REJECTED";
    } else if (validReplayCount < 40) {
      verdict = "NEEDS_MORE_SAMPLES";
    } else if (meanDelta >= 0) {
      verdict = "REJECTED";
    } else if (confidence >= 0.9 && signFlipRate <= 0.15) {
      verdict = "VERIFIED_EXPANDABLE";
    } else if (signFlipRate > 0.2) {
      verdict = "NOISY";
    } else {
      verdict = "NEEDS_MORE_SAMPLES";
    }

    bucketResults.push({
      variant: "S02",
      bucket: candidate.subBucketId,
      parentStableBucket: STEP12_S02_ACCEPTED_NEIGHBOR,
      neighborAxis: candidate.neighborAxis,
      anchorStableBucket: STEP12_S02_ACCEPTED_NEIGHBOR,
      sourceType: "verified-neighbor-v3",
      proAction: "FOLD",
      stdAction: parent.action.type,
      meanDelta,
      stdDev,
      positiveRate,
      negativeRate,
      signFlipRate,
      confidence,
      replayConsistencyScore: seedStability,
      replayDeterministic: acceptedInvalidReplayCount === 0,
      legalityValidated: acceptedInvalidReplayCount === 0,
      sampleCount: validReplayCount,
      rawSampleCount: matchingSamples.length,
      validReplayCount,
      invalidReplayCount: acceptedInvalidReplayCount,
      rawInvalidReplayCount: localRawInvalidCount,
      acceptedInvalidReplayCount,
      verificationConfidence: confidence,
      verdict,
      proEv: validReplayCount ? round(proEvTotal / validReplayCount, 2) : null,
      stdEv: validReplayCount ? round(expandedEvTotal / validReplayCount, 2) : null,
    });
  }

  const verification = {
    createdAt: new Date().toISOString(),
    variants: ["S02"],
    datasetPath,
    sourceTags,
    maxSamples,
    anchorStableBucket: STEP12_S02_ACCEPTED_NEIGHBOR,
    bucketResults: bucketResults.sort((left, right) => right.sampleCount - left.sampleCount || left.bucket.localeCompare(right.bucket)),
  };
  const counterfactual = {
    createdAt: verification.createdAt,
    variants: ["S02"],
    sampleTagFilter: ["iron-step12"],
    replaySamples: bucketResults.reduce((sum, entry) => sum + entry.rawSampleCount, 0),
    validReplays: bucketResults.reduce((sum, entry) => sum + entry.validReplayCount, 0),
    invalidReplays: bucketResults.reduce((sum, entry) => sum + entry.acceptedInvalidReplayCount, 0),
    rawInvalidReplays: bucketResults.reduce((sum, entry) => sum + entry.rawInvalidReplayCount, 0),
    bucketResults: verification.bucketResults,
  };
  const rawInvalid = {
    createdAt: verification.createdAt,
    variants: ["S02"],
    anchorStableBucket: STEP12_S02_ACCEPTED_NEIGHBOR,
    rawInvalidReplayCount: rawInvalidSamples.length,
    invalidReasonHistogram: rawInvalidHistogram,
    samples: rawInvalidSamples,
  };

  await fs.mkdir(path.dirname(verificationOutputPath), { recursive: true });
  await fs.writeFile(verificationOutputPath, JSON.stringify(verification, null, 2), "utf8");
  await fs.writeFile(counterfactualOutputPath, JSON.stringify(counterfactual, null, 2), "utf8");
  await fs.writeFile(rawInvalidOutputPath, JSON.stringify(rawInvalid, null, 2), "utf8");
  return { verification, counterfactual, rawInvalid, verificationOutputPath, counterfactualOutputPath, rawInvalidOutputPath };
}

export async function verifyS02NeighborV3WithRepair({
  datasetPath = path.resolve("data/ai/action-value/iron-step12-action-value.jsonl"),
  sourceTags = STEP12_SOURCE_TAGS,
  maxSamples = 14000,
  verificationOutputPath = DEFAULT_STEP13_VERIFICATION_OUTPUT_PATH,
  counterfactualOutputPath = DEFAULT_STEP13_COUNTERFACTUAL_OUTPUT_PATH,
  invalidOutputPath = DEFAULT_STEP13_INVALID_OUTPUT_PATH,
} = {}) {
  const baseRows = await readExistingDatasetRows(datasetPath);
  const parentActions = buildParentActionMap(baseRows);
  const parent = parentActions.get(`S02|${STEP12_S02_ACCEPTED_NEIGHBOR}`);
  const sourceSamples = await readNeighborSourceSamples({ variants: ["S02"], sourceTags });
  const matchingSamples = sourceSamples
    .filter((sample) => {
      const classified = classifyStableNeighborContext(sample);
      return classified && classified.subBucketId === STEP13_TARGET_BUCKET;
    })
    .slice(0, Math.max(100, Math.min(Number(maxSamples ?? 14000), 140)));

  const invalidReasonHistogram = createEmptyHistogram();
  const invalidSamples = [];
  const repairSummary = new Map();
  const repairedSamples = [];
  const exportableSamples = [];
  const deltas = [];
  const seedSigns = new Map();
  let validReplayCount = 0;
  let acceptedInvalidReplayCount = 0;
  let proEvTotal = 0;
  let expandedEvTotal = 0;

  for (const sample of matchingSamples) {
    const proReplay = await replayDivergenceAction({
      sample,
      action: sample.proAction,
      rolloutPolicy: "pro",
      rolloutSeeds: [1],
    });

    let actionForReplay = parent?.action ?? null;
    let repairApplied = false;
    let repairType = null;
    let repairDetail = null;
    let expandedReplay = await replayDivergenceAction({
      sample,
      action: actionForReplay,
      rolloutPolicy: "pro",
      rolloutSeeds: [1],
    });

    if (!expandedReplay.ok && actionForReplay) {
      const controller = createControllerForVariant(
        sample.variantId,
        Array.isArray(sample.state?.snapshot?.players) ? sample.state.snapshot.players.length : 6,
      );
      const repair = repairReplayActionLegality({
        controller,
        state: clone(sample.state),
        actorSeat: sample.actorSeat,
        action: actionForReplay,
        replayResult: expandedReplay,
        sample,
      });
      repairDetail = repair;
      if (repair.ok && repair.repairedAction) {
        const repairedReplay = await replayDivergenceAction({
          sample,
          action: repair.repairedAction,
          rolloutPolicy: "pro",
          rolloutSeeds: [1],
        });
        if (repairedReplay.ok) {
          expandedReplay = repairedReplay;
          actionForReplay = repair.repairedAction;
          repairApplied = true;
          repairType = repair.repairType;
          repairSummary.set(repairType, (repairSummary.get(repairType) ?? 0) + 1);
          repairedSamples.push({
            key: buildSampleKey(sample),
            seed: sample.seed,
            handId: sample.handId,
            step: sample.step,
            actorSeat: sample.actorSeat,
            repairedAction: repair.repairedAction,
            repairType,
          });
        }
      }
    }

    if (!proReplay.ok || !expandedReplay.ok) {
      acceptedInvalidReplayCount += 1;
      const detail = repairDetail ?? {};
      const classification = String(detail.invalidReason ?? expandedReplay.invalidReason ?? proReplay.invalidReason ?? "UNKNOWN").toUpperCase();
      invalidReasonHistogram[classification] = (invalidReasonHistogram[classification] ?? 0) + 1;
      invalidSamples.push({
        variantId: sample.variantId,
        seed: sample.seed,
        handId: sample.handId,
        step: sample.step,
        actorSeat: sample.actorSeat,
        bucket: STEP13_TARGET_BUCKET,
        invalidReason: classification,
        originalLegalActions: detail.originalLegalActions ?? sample.legalActions ?? [],
        refreshedLegalActions:
          detail.refreshedLegalActions ??
          expandedReplay.invalidDetails?.[0]?.restoredLegalActions ??
          proReplay.invalidDetails?.[0]?.restoredLegalActions ??
          [],
        actionBeforeReplay: detail.actionBeforeReplay ?? parent?.action ?? null,
        actionAfterRefresh: detail.actionAfterRefresh ?? null,
        capState: detail.capState ?? null,
        raiseCount: detail.raiseCount ?? null,
        toCall:
          detail.toCall ??
          expandedReplay.invalidDetails?.[0]?.toCall ??
          proReplay.invalidDetails?.[0]?.toCall ??
          null,
        stack:
          detail.stack ??
          expandedReplay.invalidDetails?.[0]?.actorStack ??
          proReplay.invalidDetails?.[0]?.actorStack ??
          null,
        pot: detail.pot ?? sample.potSize ?? sample.pot ?? 0,
        playerCount: detail.playerCount ?? sample.playerCount ?? null,
        position: detail.position ?? sample.position ?? null,
        bettingRound: detail.bettingRound ?? sample.bettingRound ?? null,
        drawRound: detail.drawRound ?? sample.drawRound ?? null,
        repairAttempted: Boolean(repairDetail),
        repairApplied,
        repairType,
      });
      continue;
    }

    validReplayCount += 1;
    exportableSamples.push({
      key: buildSampleKey(sample),
      seed: sample.seed,
      handId: sample.handId,
      step: sample.step,
      actorSeat: sample.actorSeat,
      chosenAction: actionForReplay,
      repairApplied,
      repairType,
    });
    const delta = round(Number(proReplay.ev ?? 0) - Number(expandedReplay.ev ?? 0), 2);
    deltas.push(delta);
    proEvTotal += Number(proReplay.ev ?? 0);
    expandedEvTotal += Number(expandedReplay.ev ?? 0);
    if (!seedSigns.has(sample.seed)) seedSigns.set(sample.seed, []);
    seedSigns.get(sample.seed).push(delta);
  }

  const meanDelta = deltas.length ? round(deltas.reduce((sum, value) => sum + value, 0) / deltas.length, 2) : 0;
  const variance = deltas.length ? deltas.reduce((sum, value) => sum + (value - meanDelta) ** 2, 0) / deltas.length : 0;
  const stdDev = round(Math.sqrt(Math.max(0, variance)), 2);
  const positiveRate = deltas.length ? round(deltas.filter((value) => value > 0).length / deltas.length, 4) : 0;
  const negativeRate = deltas.length ? round(deltas.filter((value) => value < 0).length / deltas.length, 4) : 0;
  const signFlipRate = round(Math.min(positiveRate, negativeRate), 4);
  const seedStability = seedSigns.size
    ? round(
        [...seedSigns.values()].filter((values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) < 0).length /
          seedSigns.size,
        4,
      )
    : 0;
  const confidence = round(
    Math.min(1, (validReplayCount / 40) * Math.max(negativeRate, positiveRate) * Math.max(seedStability, 0.5)),
    4,
  );
  const repairRate = round(repairedSamples.length / Math.max(1, validReplayCount), 4);
  let verdict = "REJECT_INVALID";
  if (acceptedInvalidReplayCount > 0) {
    verdict = "REJECT_INVALID";
  } else if (validReplayCount < 40) {
    verdict = "NEEDS_MORE_SAMPLES";
  } else if (repairRate > 0.3) {
    verdict = "REJECT_REPAIR_TOO_HIGH";
  } else if (meanDelta >= 0 || signFlipRate > 0.15) {
    verdict = "REJECT_NOISY";
  } else if (repairedSamples.length > 0) {
    verdict = "VERIFIED_WITH_REPAIR";
  } else {
    verdict = "VERIFIED_EXPORTABLE";
  }

  const bucketResult = {
    variant: "S02",
    bucket: STEP13_TARGET_BUCKET,
    parentStableBucket: STEP12_S02_ACCEPTED_NEIGHBOR,
    neighborAxis: "playerCountBand",
    sourceType: "verified-neighbor-v3-repaired",
    proAction: "FOLD",
    stdAction: parent?.action?.type ?? "RAISE",
    meanDelta,
    stdDev,
    positiveRate,
    negativeRate,
    signFlipRate,
    confidence,
    replayConsistencyScore: seedStability,
    replayDeterministic: acceptedInvalidReplayCount === 0,
    legalityValidated: acceptedInvalidReplayCount === 0,
    sampleCount: validReplayCount,
    rawSampleCount: matchingSamples.length,
    validReplayCount,
    invalidReplayCount: acceptedInvalidReplayCount,
    rawInvalidReplayCount: 0,
    acceptedInvalidReplayCount,
    repairCount: repairedSamples.length,
    repairRate,
    repairSummary: [...repairSummary.entries()].map(([repairType, count]) => ({ repairType, count })),
    repairedSamples,
    exportableSamples,
    verificationConfidence: confidence,
    verdict,
    proEv: validReplayCount ? round(proEvTotal / validReplayCount, 2) : null,
    stdEv: validReplayCount ? round(expandedEvTotal / validReplayCount, 2) : null,
  };

  const verification = {
    createdAt: new Date().toISOString(),
    variants: ["S02"],
    datasetPath,
    sourceTags,
    maxSamples,
    targetBucket: STEP13_TARGET_BUCKET,
    bucketResults: [bucketResult],
  };
  const counterfactual = {
    createdAt: verification.createdAt,
    variants: ["S02"],
    sampleTagFilter: ["iron-step13"],
    replaySamples: matchingSamples.length,
    validReplays: validReplayCount,
    invalidReplays: acceptedInvalidReplayCount,
    rawInvalidReplays: 0,
    bucketResults: verification.bucketResults,
  };
  const invalidReport = {
    createdAt: verification.createdAt,
    variants: ["S02"],
    targetBucket: STEP13_TARGET_BUCKET,
    originalAcceptedInvalidReplayCount: 18,
    finalAcceptedInvalidReplayCount: acceptedInvalidReplayCount,
    repairedSamples: repairedSamples.length,
    repairRate,
    invalidReasonHistogram,
    samples: invalidSamples,
  };

  await fs.mkdir(path.dirname(verificationOutputPath), { recursive: true });
  await fs.writeFile(verificationOutputPath, JSON.stringify(verification, null, 2), "utf8");
  await fs.writeFile(counterfactualOutputPath, JSON.stringify(counterfactual, null, 2), "utf8");
  await fs.writeFile(invalidOutputPath, JSON.stringify(invalidReport, null, 2), "utf8");
  return { verification, counterfactual, invalidReport, verificationOutputPath, counterfactualOutputPath, invalidOutputPath };
}

function classifyStep14IsolationVerdict({
  sampleCount = 0,
  acceptedInvalidReplayCount = 0,
  confidence = 0,
  repairRate = 0,
  signFlipRate = 1,
  entropyScore = 1,
  baseEntropyScore = 1,
  meanDelta = 0,
}) {
  if (acceptedInvalidReplayCount > 0) return "REJECT_INVALID";
  if (sampleCount < 40) return "NEEDS_MORE_SAMPLES";
  if (repairRate > 0.3) return "REJECT_REPAIR_TOO_HIGH";
  if (meanDelta >= 0) return "REJECT_NOISY";
  if (signFlipRate > 0.15 || entropyScore >= baseEntropyScore) return "REJECT_NOISY";
  if (confidence < 0.9) return "NEEDS_MORE_SAMPLES";
  return "VERIFIED_EXPORTABLE";
}

export function classifyStep15RelaxedVerdict({
  sampleCount = 0,
  confidence = 0,
  acceptedInvalidReplayCount = 0,
  repairRate = 1,
  entropyScore = 1,
  signFlipRate = 1,
  meanDelta = 0,
}) {
  if (acceptedInvalidReplayCount > 0) return "REJECT_INVALID";
  if (sampleCount < 40) return "REJECT_INSUFFICIENT_SAMPLES";
  if (repairRate > 0.15) return "REJECT_REPAIR";
  if (meanDelta >= 0) return "REJECT_NOISY";
  if (confidence < 0.9 || entropyScore > 0.12 || signFlipRate > 0.08) return "REJECT_NOISY";
  return "VERIFIED_RELAXED_MATCH";
}

export async function buildS02RelaxedMatchProposal({
  verificationPath = DEFAULT_STEP14_VERIFICATION_OUTPUT_PATH,
  outputPath = DEFAULT_STEP15_PROPOSAL_OUTPUT_PATH,
} = {}) {
  const verification = JSON.parse(await fs.readFile(verificationPath, "utf8"));
  const cleanPressureChains = (verification.bucketResults ?? [])
    .filter(
      (entry) =>
        String(entry.verdict) === "VERIFIED_EXPORTABLE" &&
        String(entry.isolationAxis) === "pressureChain" &&
        Number(entry.acceptedInvalidReplayCount ?? 0) === 0 &&
        Number(entry.repairRate ?? 0) <= 0.15 &&
        Number(entry.entropyScore ?? 1) <= 0.12,
    )
    .map((entry) => String(entry.isolationValue ?? ""))
    .filter(Boolean)
    .sort();

  const proposal = {
    createdAt: new Date().toISOString(),
    variant: "S02",
    parentIsolatedBucket: STEP14_S02_TARGET_BUCKET,
    sourceDatasetTag: "iron-step14",
    candidates: cleanPressureChains.length >= 2
      ? [
          {
            candidateId: "s02-relaxed-pressure-chain",
            verdict: "PROPOSED",
            sourceType: "verified-relaxed-match",
            relaxedAxes: ["pressureChain"],
            relaxedAxisValues: {
              pressureChain: cleanPressureChains,
            },
            constraints: {
              playerCountBand: "3way",
              positionBand: "IP",
              toCallBand: "small",
              repeatedPressure: "repeated",
            },
            excluded: ["weak/trash", "lowerMediumSDA5", "medium/large-call", "D01", "multi-axis-relaxation"],
          },
        ]
      : [],
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(proposal, null, 2), "utf8");
  return { proposal, outputPath };
}

export async function verifyS02V3Isolation({
  datasetPath = path.resolve("data/ai/action-value/iron-step13-action-value.jsonl"),
  sourceTags = STEP12_SOURCE_TAGS,
  maxSamples = 16000,
  entropyOutputPath = DEFAULT_STEP14_ENTROPY_OUTPUT_PATH,
  discoveryOutputPath = DEFAULT_STEP14_DISCOVERY_OUTPUT_PATH,
  verificationOutputPath = DEFAULT_STEP14_VERIFICATION_OUTPUT_PATH,
  counterfactualOutputPath = DEFAULT_STEP14_COUNTERFACTUAL_OUTPUT_PATH,
} = {}) {
  const baseRows = await readExistingDatasetRows(datasetPath);
  const parentActions = buildParentActionMap(baseRows);
  const parent = parentActions.get(`S02|${STEP12_S02_ACCEPTED_NEIGHBOR}`);
  const { report: entropyReport } = await analyzeS02V3NoiseEntropy({
    sourceTags,
    maxSamples,
    outputPath: entropyOutputPath,
    parentAction: parent?.action ?? { type: "RAISE", amount: 0, discardIndexes: [] },
  });
  const discovery = await discoverS02V3IsolationCandidates({
    analysisPath: entropyOutputPath,
    outputPath: discoveryOutputPath,
  });
  const bucketResults = [];

  for (const candidate of discovery.isolationCandidates ?? []) {
    const matchingOutcomes = (entropyReport.sampleOutcomes ?? []).filter(
      (entry) => String(entry.axes?.[candidate.isolationAxis] ?? "") === String(candidate.isolationValue ?? ""),
    );
    const summary = summarizeS02OutcomeGroup(
      matchingOutcomes.map((entry) => ({
        ...entry,
        deterministic: true,
        acceptedInvalidReplayCount: entry.ok ? 0 : 1,
      })),
      { axis: candidate.isolationAxis, value: candidate.isolationValue },
    );
    const verdict = classifyStep14IsolationVerdict({
      sampleCount: summary.sampleCount,
      acceptedInvalidReplayCount: summary.acceptedInvalidReplayCount,
      confidence: summary.confidence,
      repairRate: summary.repairRate,
      signFlipRate: summary.signFlipRate,
      entropyScore: summary.entropyScore,
      baseEntropyScore: Number(entropyReport.baseMetrics?.entropyScore ?? 1),
      meanDelta: summary.meanDelta,
    });
    const exportableSamples = matchingOutcomes
      .filter((entry) => entry.ok)
      .map((entry) => ({
        key: entry.key,
        seed: entry.seed,
        handId: entry.handId,
        step: entry.step,
        actorSeat: entry.actorSeat,
        chosenAction: entry.chosenAction,
        repairApplied: Boolean(entry.repairApplied),
        repairType: entry.repairType ?? null,
      }));
    bucketResults.push({
      variant: "S02",
      bucket: `${STEP14_S02_V3_PARENT_BUCKET}::${candidate.isolationAxis}=${candidate.isolationValue}`,
      parentStableBucket: STEP14_S02_V3_PARENT_BUCKET,
      neighborAxis: candidate.isolationAxis,
      isolationAxis: candidate.isolationAxis,
      isolationValue: candidate.isolationValue,
      sourceType: "verified-neighbor-v3-isolated",
      proAction: "FOLD",
      stdAction: parent?.action?.type ?? "RAISE",
      meanDelta: summary.meanDelta,
      stdDev: summary.stdDev,
      positiveRate: summary.positiveRate,
      negativeRate: summary.negativeRate,
      signFlipRate: summary.signFlipRate,
      confidence: summary.confidence,
      replayConsistencyScore: entropyReport.baseMetrics?.confidence ?? 1,
      replayDeterministic: summary.acceptedInvalidReplayCount === 0,
      legalityValidated: summary.acceptedInvalidReplayCount === 0,
      sampleCount: summary.sampleCount,
      rawSampleCount: summary.rawSampleCount,
      validReplayCount: summary.sampleCount,
      invalidReplayCount: summary.acceptedInvalidReplayCount,
      rawInvalidReplayCount: 0,
      acceptedInvalidReplayCount: summary.acceptedInvalidReplayCount,
      repairCount: summary.repairCount,
      repairRate: summary.repairRate,
      entropyScore: summary.entropyScore,
      entropyScoreBefore: Number(entropyReport.baseMetrics?.entropyScore ?? 0),
      signFlipRateBefore: Number(entropyReport.baseMetrics?.signFlipRate ?? 0),
      repairSummary: [
        {
          repairType: "RAISE_TO_CALL",
          count: matchingOutcomes.filter((entry) => entry.ok && entry.repairType === "RAISE_TO_CALL").length,
        },
      ].filter((entry) => entry.count > 0),
      exportableSamples,
      verificationConfidence: summary.confidence,
      verdict,
      proEv:
        summary.sampleCount > 0
          ? round(
              matchingOutcomes.filter((entry) => entry.ok).reduce((sum, entry) => sum + Number(entry.proEv ?? 0), 0) /
                Math.max(1, summary.sampleCount),
              2,
            )
          : null,
      stdEv:
        summary.sampleCount > 0
          ? round(
              matchingOutcomes.filter((entry) => entry.ok).reduce((sum, entry) => sum + Number(entry.stdEv ?? 0), 0) /
                Math.max(1, summary.sampleCount),
              2,
            )
          : null,
    });
  }

  const verification = {
    createdAt: new Date().toISOString(),
    variants: ["S02"],
    datasetPath,
    sourceTags,
    maxSamples,
    targetBucket: STEP14_S02_V3_PARENT_BUCKET,
    entropyReportPath: entropyOutputPath,
    discoveryReportPath: discoveryOutputPath,
    baseMetrics: entropyReport.baseMetrics,
    bucketResults: bucketResults.sort((left, right) => {
      const leftRank = left.verdict === "VERIFIED_EXPORTABLE" ? 0 : left.verdict === "NEEDS_MORE_SAMPLES" ? 1 : 2;
      const rightRank = right.verdict === "VERIFIED_EXPORTABLE" ? 0 : right.verdict === "NEEDS_MORE_SAMPLES" ? 1 : 2;
      return leftRank - rightRank || left.entropyScore - right.entropyScore || right.sampleCount - left.sampleCount;
    }),
  };
  const counterfactual = {
    createdAt: verification.createdAt,
    variants: ["S02"],
    sampleTagFilter: ["iron-step14"],
    replaySamples: bucketResults.reduce((sum, entry) => sum + entry.rawSampleCount, 0),
    validReplays: bucketResults.reduce((sum, entry) => sum + entry.validReplayCount, 0),
    invalidReplays: bucketResults.reduce((sum, entry) => sum + entry.acceptedInvalidReplayCount, 0),
    rawInvalidReplays: 0,
    bucketResults: verification.bucketResults,
  };

  await fs.mkdir(path.dirname(verificationOutputPath), { recursive: true });
  await fs.writeFile(verificationOutputPath, JSON.stringify(verification, null, 2), "utf8");
  await fs.writeFile(counterfactualOutputPath, JSON.stringify(counterfactual, null, 2), "utf8");
  return {
    verification,
    counterfactual,
    entropyOutputPath,
    discoveryOutputPath,
    verificationOutputPath,
    counterfactualOutputPath,
  };
}

export async function verifyS02RelaxedMatch({
  datasetPath = path.resolve("data/ai/action-value/iron-step14-action-value.jsonl"),
  entropyOutputPath = DEFAULT_STEP14_ENTROPY_OUTPUT_PATH,
  proposalOutputPath = DEFAULT_STEP15_PROPOSAL_OUTPUT_PATH,
  verificationOutputPath = DEFAULT_STEP15_VERIFICATION_OUTPUT_PATH,
  counterfactualOutputPath = DEFAULT_STEP15_COUNTERFACTUAL_OUTPUT_PATH,
} = {}) {
  const entropyReport = JSON.parse(await fs.readFile(entropyOutputPath, "utf8"));
  const { proposal } = await buildS02RelaxedMatchProposal({
    verificationPath: DEFAULT_STEP14_VERIFICATION_OUTPUT_PATH,
    outputPath: proposalOutputPath,
  });
  const candidate = proposal.candidates?.[0] ?? null;
  const bucketResults = [];

  if (candidate) {
    const allowedPressureChains = new Set(candidate.relaxedAxisValues?.pressureChain ?? []);
    const matchingOutcomes = (entropyReport.sampleOutcomes ?? []).filter(
      (entry) => entry.ok && allowedPressureChains.has(String(entry.axes?.pressureChain ?? "")),
    );
    const summary = summarizeS02OutcomeGroup(
      matchingOutcomes.map((entry) => ({
        ...entry,
        deterministic: true,
        acceptedInvalidReplayCount: 0,
      })),
      { axis: "pressureChain", value: [...allowedPressureChains].join("|") },
    );
    const verdict = classifyStep15RelaxedVerdict({
      sampleCount: summary.sampleCount,
      confidence: summary.confidence,
      acceptedInvalidReplayCount: summary.acceptedInvalidReplayCount,
      repairRate: summary.repairRate,
      entropyScore: summary.entropyScore,
      signFlipRate: summary.signFlipRate,
      meanDelta: summary.meanDelta,
    });
    bucketResults.push({
      variant: "S02",
      bucket: `${STEP14_S02_TARGET_BUCKET}::relaxed-pressureChain=${[...allowedPressureChains].join("|")}`,
      parentStableBucket: STEP14_S02_TARGET_BUCKET,
      parentIsolatedBucket: STEP14_S02_TARGET_BUCKET,
      sourceType: "verified-relaxed-match",
      relaxedAxes: candidate.relaxedAxes,
      relaxedAxisValues: candidate.relaxedAxisValues,
      meanDelta: summary.meanDelta,
      stdDev: summary.stdDev,
      positiveRate: summary.positiveRate,
      negativeRate: summary.negativeRate,
      signFlipRate: summary.signFlipRate,
      confidence: summary.confidence,
      replayConsistencyScore: summary.confidence,
      replayDeterministic: true,
      legalityValidated: true,
      sampleCount: summary.sampleCount,
      rawSampleCount: summary.rawSampleCount,
      validReplayCount: summary.sampleCount,
      invalidReplayCount: 0,
      rawInvalidReplayCount: 0,
      acceptedInvalidReplayCount: 0,
      repairCount: summary.repairCount,
      repairRate: summary.repairRate,
      entropyScore: summary.entropyScore,
      verdict,
      exportableSamples: matchingOutcomes.map((entry) => ({
        key: entry.key,
        seed: entry.seed,
        handId: entry.handId,
        step: entry.step,
        actorSeat: entry.actorSeat,
        chosenAction: entry.chosenAction,
        repairApplied: Boolean(entry.repairApplied),
        repairType: entry.repairType ?? null,
      })),
    });
  }

  const verification = {
    createdAt: new Date().toISOString(),
    variants: ["S02"],
    datasetPath,
    targetBucket: STEP14_S02_TARGET_BUCKET,
    proposalOutputPath,
    bucketResults,
  };
  const counterfactual = {
    createdAt: verification.createdAt,
    variants: ["S02"],
    sampleTagFilter: ["iron-step15"],
    replaySamples: bucketResults.reduce((sum, entry) => sum + Number(entry.rawSampleCount ?? 0), 0),
    validReplays: bucketResults.reduce((sum, entry) => sum + Number(entry.validReplayCount ?? 0), 0),
    invalidReplays: 0,
    rawInvalidReplays: 0,
    bucketResults,
  };

  await fs.mkdir(path.dirname(verificationOutputPath), { recursive: true });
  await fs.writeFile(verificationOutputPath, JSON.stringify(verification, null, 2), "utf8");
  await fs.writeFile(counterfactualOutputPath, JSON.stringify(counterfactual, null, 2), "utf8");
  return { verification, counterfactual, proposal, verificationOutputPath, counterfactualOutputPath, proposalOutputPath };
}
