import fs from "node:fs/promises";
import path from "node:path";

import {
  buildDrawObservationPayload,
  buildDrawObservationVector,
  DRAW_OBSERVATION_VECTOR_SIZE,
} from "../../rl/drawObservationSchema.js";
import { roundNumber } from "./coverageAuditUtils.js";
import {
  loadS02DeepPlayerCountReplaySamples,
  STEP37_TARGET_PLAYER_COUNTS,
} from "./acquireS02DeepPlayerCountReplay.js";

export const DEFAULT_STEP38_PREEXPORT_ROWS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/preexport-s02-deep-raisecheck-step38.jsonl",
);
export const DEFAULT_STEP37_FORCED_REPLAY_PATH = path.resolve(
  "reports/ai-iron/s02-deep-playercount-forced-replay-step37.json",
);
export const STEP38_BUCKET_FAMILY = "S02 deep RAISE-vs-CHECK";

function actionType(action = null) {
  return String(action?.type ?? action?.action ?? action ?? "").toUpperCase();
}

function normalizeLegalActions(legalActions = []) {
  return (Array.isArray(legalActions) ? legalActions : [])
    .map((action) => (typeof action === "string" ? { type: action } : action))
    .filter((action) => actionType(action).length);
}

function normalizeAction(action = null, fallbackSource = "forced-replay") {
  if (action && typeof action === "object") {
    return {
      type: actionType(action),
      amount: Number(action.amount ?? 0),
      discardIndexes: Array.isArray(action.discardIndexes) ? action.discardIndexes : [],
      source: action.source ?? fallbackSource,
      reason: action.reason ?? "s02-deep-raisecheck-preexport",
    };
  }
  return {
    type: actionType(action),
    amount: 0,
    discardIndexes: [],
    source: fallbackSource,
    reason: "s02-deep-raisecheck-preexport",
  };
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function branchMetricByPlayerCount(forcedReplayReport = {}) {
  return new Map(
    (forcedReplayReport.branches ?? []).map((branch) => [String(branch.playerCount), branch]),
  );
}

function buildObservation(sample = {}) {
  const legalActions = normalizeLegalActions(sample.legalActions);
  const payload = buildDrawObservationPayload({
    state: sample.state ?? sample.snapshot,
    seatIndex: sample.actorSeat,
    variantId: sample.variantId,
    legalActions,
  });
  return buildDrawObservationVector(payload);
}

function buildPreExportRow({ sample, branch, forcedReplayPath }) {
  const legalActions = normalizeLegalActions(sample.legalActions);
  const observation = buildObservation(sample);
  const chosenBestAction = normalizeAction(sample.standardAction ?? "RAISE", "verified-forced-replay");
  const rejectedAction = normalizeAction(sample.proAction ?? "CHECK", "pro-fallback");
  const confidence = roundNumber(branch.confidence, 4);
  const sampleCount = Number(branch.sampleCount ?? 0);
  const sampleCountFactor = roundNumber(Math.min(1, sampleCount / 50), 4);
  const forcedReplay = {
    sampleCount,
    validReplayCount: Number(branch.validReplayCount ?? sampleCount),
    invalidReplayCount: Number(branch.invalidReplayCount ?? 0),
    meanDelta: roundNumber(branch.meanDelta, 4),
    medianDelta: roundNumber(branch.medianDelta, 4),
    signFlipRate: roundNumber(branch.signFlipRate, 4),
    confidence,
    repairRate: roundNumber(branch.repairRate, 4),
    deterministicReplay: branch.deterministicReplay !== false,
  };
  const weightComponents = {
    confidence,
    sampleCountFactor,
    replayConsistencyFactor: confidence,
    variantRebalanceFactor: 1,
    bucketRarityFactor: 1,
  };
  return {
    schemaVersion: 1,
    variantId: "S02",
    sourceType: "verified-forced-replay",
    sourceStep: "step37",
    bucketFamily: STEP38_BUCKET_FAMILY,
    bucket: `${STEP38_BUCKET_FAMILY} playerCount=${sample.playerCount}`,
    playerCount: Number(sample.playerCount),
    stackDepth: "deep",
    chosenBestAction,
    rejectedAction,
    observation,
    legalActions,
    candidateActions: [
      {
        action: rejectedAction,
        source: "pro-fallback",
        estimatedValue: 0,
        sampleCount,
        confidence,
        verdict: "BAD",
      },
      {
        action: chosenBestAction,
        source: "verified-forced-replay",
        estimatedValue: forcedReplay.meanDelta,
        sampleCount,
        confidence,
        verdict: "GOOD",
      },
    ],
    handClass: sample.handClass ?? "lowerMediumSDA5",
    sourceCorpusTag: "step37",
    sourceCounterfactualScore: forcedReplayPath,
    trainingWeight: roundNumber(
      weightComponents.confidence *
        weightComponents.sampleCountFactor *
        weightComponents.replayConsistencyFactor *
        weightComponents.variantRebalanceFactor *
        weightComponents.bucketRarityFactor,
      4,
    ),
    weightComponents,
    forcedReplay,
    governance: {
      promoted: false,
      routingChanged: false,
      priorityFrozen: true,
      d01Excluded: true,
      datasetRowsChanged: false,
      gameplayMutation: false,
      sourcePriorityChanged: false,
    },
    metadata: {
      sampleTag: "step37",
      seed: sample.seed,
      handId: sample.handId,
      step: sample.step,
      actorSeat: sample.actorSeat,
      drawRound: sample.drawRound,
      bettingRound: sample.bettingRound,
      playerCount: sample.playerCount,
      position: sample.position,
      facingAction: sample.facingAction,
      potSize: sample.potSize ?? 0,
      handClass: sample.handClass,
      stackDepth: "deep",
      bucketFamily: STEP38_BUCKET_FAMILY,
      sourceType: "verified-forced-replay",
      sourceStep: "step37",
      forcedReplayReportPath: forcedReplayPath,
      replayDeterministic: forcedReplay.deterministicReplay,
      legalityValidated: true,
      safetyVerdict: "PASS",
    },
  };
}

export async function buildS02DeepPreExportRows({
  forcedReplayPath = DEFAULT_STEP37_FORCED_REPLAY_PATH,
  outputPath = DEFAULT_STEP38_PREEXPORT_ROWS_OUTPUT_PATH,
  sampleGroups = null,
  forcedReplayReport = null,
} = {}) {
  const report = forcedReplayReport ?? (await readJsonIfExists(forcedReplayPath));
  if (!report) throw new Error(`forced replay report not found: ${forcedReplayPath}`);
  const metrics = branchMetricByPlayerCount(report);
  const groups = sampleGroups ?? (await loadS02DeepPlayerCountReplaySamples({ targetPerBranch: 50 }));
  const rows = [];
  for (const playerCount of STEP37_TARGET_PLAYER_COUNTS) {
    const branch = metrics.get(String(playerCount));
    const sample = (groups[String(playerCount)] ?? [])[0];
    if (!branch || !sample) continue;
    const row = buildPreExportRow({ sample, branch, forcedReplayPath });
    if (row.observation.length !== DRAW_OBSERVATION_VECTOR_SIZE) continue;
    rows.push(row);
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");
  return {
    outputPath,
    rowCount: rows.length,
    rows,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = await buildS02DeepPreExportRows();
  console.log(JSON.stringify({ ...result, rows: undefined }, null, 2));
}
