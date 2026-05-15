import fs from "node:fs/promises";
import path from "node:path";

import { parseReplaySampleFilename } from "../evaluation/counterfactualBuckets.js";
import { roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const STEP28_BUCKET = "S02 lowerMediumSDA5 bet-pressure";
export const STEP28_VARIANT = "S02";
export const STEP28_REPLAY_SAMPLE_DIR = path.resolve("reports/ai-eval/divergence-replay-samples");

export function actionName(action = null) {
  return String(action?.type ?? action ?? "").toUpperCase();
}

export function entropyFromCounts(counts = {}) {
  const values = Object.values(counts).map(Number).filter((value) => value > 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  const entropy = values.reduce((sum, value) => {
    const probability = value / total;
    return sum - probability * Math.log2(probability);
  }, 0);
  const maxEntropy = Math.log2(Math.max(2, values.length));
  return roundNumber(entropy / maxEntropy, 4);
}

export function countBy(items = [], keyFn = () => "") {
  return items.reduce((counts, item) => {
    const key = String(keyFn(item) ?? "unknown");
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

export function signFlipRate(values = []) {
  const numeric = values.map(Number).filter((value) => Number.isFinite(value) && value !== 0);
  if (!numeric.length) return 0;
  const positive = numeric.filter((value) => value > 0).length;
  const negative = numeric.filter((value) => value < 0).length;
  return roundNumber(Math.min(positive, negative) / numeric.length, 4);
}

export function average(values = []) {
  const numeric = values.map(Number).filter(Number.isFinite);
  return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : 0;
}

export function stddev(values = []) {
  const numeric = values.map(Number).filter(Number.isFinite);
  if (!numeric.length) return 0;
  const mean = average(numeric);
  return Math.sqrt(average(numeric.map((value) => (value - mean) ** 2)));
}

export function playerCountBucket(sample = {}) {
  const count = Number(sample.playerCount ?? 0);
  if (count >= 4) return "4way+";
  if (count === 3) return "3way";
  if (count > 0) return "heads-up";
  return "unknown";
}

export function pressureChain(sample = {}) {
  const meta = sample.snapshot?.metadata ?? sample.state?.snapshot?.metadata ?? {};
  const last = meta.lastBettingAction?.type ?? sample.facingAction ?? "none";
  const raises = Number(meta.raiseCountThisRound ?? 0);
  return `${String(last).toLowerCase()}|raises=${Number.isFinite(raises) ? raises : 0}`;
}

export function stackDepth(sample = {}) {
  const stack = Number(sample.snapshot?.players?.[sample.actorSeat]?.stack ?? sample.stacks?.find?.((entry) => entry.seatIndex === sample.actorSeat)?.stack ?? 0);
  if (stack >= 400) return "deep";
  if (stack >= 200) return "medium";
  if (stack > 0) return "short";
  return "unknown";
}

export function toCallRatio(sample = {}) {
  const currentBet = Number(sample.snapshot?.currentBet ?? sample.snapshot?.metadata?.currentBet ?? 0);
  const actorBet = Number(sample.snapshot?.players?.[sample.actorSeat]?.betThisRound ?? sample.snapshot?.players?.[sample.actorSeat]?.bet ?? 0);
  const toCall = Math.max(0, currentBet - actorBet);
  const pot = Math.max(1, Number(sample.snapshot?.pot ?? sample.snapshot?.metadata?.potAmount ?? sample.potSize ?? 0));
  const ratio = toCall / pot;
  if (ratio <= 0) return "0";
  if (ratio <= 0.25) return "<=0.25";
  if (ratio <= 0.5) return "<=0.50";
  return ">0.50";
}

export function potOddsBand(sample = {}) {
  const currentBet = Number(sample.snapshot?.currentBet ?? sample.snapshot?.metadata?.currentBet ?? 0);
  const actorBet = Number(sample.snapshot?.players?.[sample.actorSeat]?.betThisRound ?? sample.snapshot?.players?.[sample.actorSeat]?.bet ?? 0);
  const toCall = Math.max(0, currentBet - actorBet);
  const pot = Math.max(1, Number(sample.snapshot?.pot ?? sample.snapshot?.metadata?.potAmount ?? sample.potSize ?? 0));
  const odds = toCall / (pot + toCall);
  if (odds <= 0) return "free";
  if (odds <= 0.2) return "cheap";
  if (odds <= 0.34) return "medium";
  return "expensive";
}

export function callBand(sample = {}) {
  const legal = Array.isArray(sample.legalActions) ? sample.legalActions : [];
  if (!legal.map(actionName).includes("CALL")) return "none";
  const drawRound = Number(sample.drawRound ?? 0);
  return drawRound >= 1 ? "big" : "small";
}

export function sampleAxisValue(sample = {}, axis = "") {
  switch (axis) {
    case "playerCount":
      return playerCountBucket(sample);
    case "position":
      return sample.position ?? "unknown";
    case "callBand":
      return callBand(sample);
    case "pressureFamily":
      return sample.facingAction === "bet" ? "bet-pressure" : `${sample.facingAction ?? "none"}-pressure`;
    case "pressureChain":
      return pressureChain(sample);
    case "stackDepth":
      return stackDepth(sample);
    case "drawRound":
      return `draw-${sample.drawRound ?? "unknown"}`;
    case "bettingRound":
      return `bet-${sample.bettingRound ?? "unknown"}`;
    case "handClassStrength":
      return sample.handClass ?? "unknown";
    case "toCallRatio":
      return toCallRatio(sample);
    case "potOddsBand":
      return potOddsBand(sample);
    default:
      return sample[axis] ?? "unknown";
  }
}

export function isFocusedS02LowerMediumSample(sample = {}) {
  return (
    String(sample.variantId ?? "").toUpperCase() === STEP28_VARIANT &&
    String(sample.handClass ?? "") === "lowerMediumSDA5" &&
    String(sample.facingAction ?? "").toLowerCase() === "bet"
  );
}

export async function loadFocusedS02Samples({
  sampleDir = STEP28_REPLAY_SAMPLE_DIR,
  maxSamples = 120,
} = {}) {
  const files = (await fs.readdir(sampleDir).catch(() => []))
    .filter((file) => file.endsWith(".jsonl"))
    .filter((file) => parseReplaySampleFilename(file)?.variant === "S02")
    .sort();
  const seen = new Set();
  const samples = [];
  for (const file of files) {
    const parsed = parseReplaySampleFilename(file);
    const content = await fs.readFile(path.join(sampleDir, file), "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      let sample = null;
      try {
        sample = JSON.parse(line);
      } catch {
        continue;
      }
      if (!isFocusedS02LowerMediumSample(sample)) continue;
      const key = [sample.variantId, sample.seed, sample.handId, sample.step, sample.actorSeat, actionName(sample.proAction), actionName(sample.standardAction)].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      samples.push({ ...sample, sampleTag: parsed?.tag ?? "unknown", sampleFile: file });
    }
  }
  samples.sort((left, right) => {
    const leftKey = [left.drawRound ?? 0, left.position ?? "", left.seed ?? 0, left.handId ?? 0, left.step ?? 0].join("|");
    const rightKey = [right.drawRound ?? 0, right.position ?? "", right.seed ?? 0, right.handId ?? 0, right.step ?? 0].join("|");
    return leftKey.localeCompare(rightKey);
  });
  const groups = new Map();
  samples.forEach((sample) => {
    const key = [sample.position ?? "unknown", sample.drawRound ?? "unknown", pressureChain(sample)].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sample);
  });
  const queues = [...groups.values()];
  const balanced = [];
  while (balanced.length < maxSamples && queues.some((queue) => queue.length)) {
    queues.forEach((queue) => {
      if (balanced.length < maxSamples && queue.length) balanced.push(queue.shift());
    });
  }
  return balanced;
}

export function auditSampleLegalityAndRepair(sample = {}) {
  const legalActions = (sample.legalActions ?? []).map(actionName);
  const proAction = actionName(sample.proAction);
  const standardAction = actionName(sample.standardAction);
  const proLegal = legalActions.includes(proAction);
  const standardLegal = legalActions.includes(standardAction);
  const repairs = [];
  [
    ["pro", proAction],
    ["standard", standardAction],
  ].forEach(([sourcePolicy, action]) => {
    if (legalActions.includes(action)) return;
    if (action === "RAISE" && legalActions.includes("CALL")) {
      repairs.push({ sourcePolicy, ok: true, repairType: "RAISE_TO_CALL" });
    } else if (action === "CALL" && legalActions.includes("CHECK")) {
      repairs.push({ sourcePolicy, ok: true, repairType: "CALL_TO_CHECK" });
    } else {
      repairs.push({ sourcePolicy, ok: false, repairType: "ACTION_NOT_IN_REFRESHED_LEGAL" });
    }
  });
  const successfulRepair = repairs.find((repair) => repair.ok);
  return {
    invalidReplay: !proLegal || !standardLegal,
    legalActionMismatch: !proLegal || !standardLegal,
    repairRequired: repairs.length > 0,
    repairType: successfulRepair?.repairType ?? repairs[0]?.invalidReason ?? null,
    proLegal,
    standardLegal,
    repairs,
  };
}

export function buildObservationRows({
  samples = [],
  replayResults = [],
  fallbackDistribution = null,
} = {}) {
  if (replayResults.length) {
    return replayResults.map((entry) => ({
      ...entry,
      sample: entry.sample ?? samples.find((sample) => sample.seed === entry.seed && sample.handId === entry.handId && sample.step === entry.step),
    }));
  }
  return samples.map((sample) => {
    const legality = auditSampleLegalityAndRepair(sample);
    const standardAction = actionName(sample.standardAction);
    const proAction = actionName(sample.proAction);
    const heuristicDelta = standardAction === "CALL" && proAction === "FOLD" ? 1 : standardAction === "RAISE" && proAction === "CALL" ? 0.5 : 0;
    return {
      sample,
      seed: sample.seed,
      handId: sample.handId,
      step: sample.step,
      standardAction,
      proAction,
      standardEv: heuristicDelta,
      proEv: 0,
      delta: heuristicDelta,
      ok: !legality.invalidReplay,
      legality,
      fallbackPolicy: "pro",
      fallbackAction: proAction,
      fallbackDistribution,
    };
  });
}

export function summarizeObservationRows(rows = []) {
  const deltas = rows.map((row) => Number(row.delta ?? 0)).filter(Number.isFinite);
  const sampleCount = rows.length;
  const invalidReplayCount = rows.filter((row) => row.legality?.invalidReplay || row.ok === false).length;
  const legalActionMismatch = rows.filter((row) => row.legality?.legalActionMismatch).length;
  const repairRows = rows.filter((row) => row.legality?.repairRequired);
  const repairRate = sampleCount ? repairRows.length / sampleCount : 0;
  const signFlip = signFlipRate(deltas);
  const deltaStddev = stddev(deltas);
  const actionDistributionEntropy = entropyFromCounts(countBy(rows, (row) => `${row.standardAction}/${row.proAction}`));
  const pressureEntropy = entropyFromCounts(countBy(rows, (row) => sampleAxisValue(row.sample, "pressureChain")));
  const fallbackEntropy = entropyFromCounts(countBy(rows, (row) => row.fallbackAction ?? row.proAction));
  const callBandEntropy = entropyFromCounts(countBy(rows, (row) => sampleAxisValue(row.sample, "callBand")));
  const positionEntropy = entropyFromCounts(countBy(rows, (row) => sampleAxisValue(row.sample, "position")));
  const entropyScore = roundNumber(
    signFlip * 0.35 +
      Math.min(1, deltaStddev / Math.max(1, Math.abs(average(deltas)) * 2 || 1)) * 0.25 +
      actionDistributionEntropy * 0.15 +
      positionEntropy * 0.1 +
      callBandEntropy * 0.1 +
      repairRate * 0.05,
    4,
  );
  const confidence = roundNumber(
    Math.min(0.95, (sampleCount / 40) * (1 - signFlip) * (1 - Math.min(0.5, repairRate))),
    4,
  );
  return {
    bucket: STEP28_BUCKET,
    sampleCount,
    meanDelta: roundNumber(average(deltas), 4),
    confidence,
    signFlipRate: signFlip,
    entropyScore,
    repairRate: roundNumber(repairRate, 4),
    invalidReplayCount,
    legalActionMismatch,
    fallbackDistribution: countBy(rows, (row) => row.fallbackAction ?? row.proAction),
    actionDistributionEntropy,
    fallbackEntropy,
    pressureEntropy,
    callBandEntropy,
    positionEntropy,
    deltaStddev: roundNumber(deltaStddev, 4),
    deterministicReplay: invalidReplayCount === 0,
  };
}

export async function writeStep28Report(outputPath, report) {
  return writeJsonReport(outputPath, {
    ...report,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    datasetRowsChanged: false,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  });
}

export function rowsFromFocusedReport(report = {}) {
  return (report.observations ?? []).map((observation) => ({
    ...observation,
    delta: Number(observation.delta ?? 0),
    standardAction: actionName(observation.standardAction),
    proAction: actionName(observation.proAction),
    legality: {
      invalidReplay: observation.ok === false,
      legalActionMismatch: observation.ok === false,
      repairRequired: Boolean(observation.repairRequired),
      repairType: observation.repairType ?? null,
    },
    sample: {
      playerCount: observation.playerCount,
      position: observation.position,
      drawRound: observation.drawRound,
      bettingRound: observation.bettingRound,
      handClass: observation.handClassStrength,
      facingAction: observation.pressureFamily === "bet-pressure" ? "bet" : observation.pressureFamily,
      _axis: {
        callBand: observation.callBand,
        pressureFamily: observation.pressureFamily,
        pressureChain: observation.pressureChain,
        stackDepth: observation.stackDepth,
        handClassStrength: observation.handClassStrength,
        toCallRatio: observation.toCallRatio,
        potOddsBand: observation.potOddsBand,
      },
    },
  }));
}

export function focusedObservationAxisValue(row = {}, axis = "") {
  const direct = row.sample?._axis?.[axis];
  if (direct !== undefined && direct !== null) return direct;
  if (axis === "playerCount") return playerCountBucket(row.sample);
  if (axis === "position") return row.sample?.position ?? "unknown";
  if (axis === "drawRound") return `draw-${row.sample?.drawRound ?? "unknown"}`;
  if (axis === "bettingRound") return `bet-${row.sample?.bettingRound ?? "unknown"}`;
  return sampleAxisValue(row.sample, axis);
}
