import { extractDecisionContext } from "./featureExtract.js";

function mean(values = []) {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function sampleStdev(values = []) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function buildOutcomeMap(handHistory) {
  const legacySeats = handHistory?.legacyRecord?.seats;
  const canonicalSeats = handHistory?.seats;
  const sourceSeats = Array.isArray(legacySeats) && legacySeats.length ? legacySeats : canonicalSeats;
  const map = new Map();
  if (!Array.isArray(sourceSeats)) return map;
  sourceSeats.forEach((seatEntry, idx) => {
    const seat = Number.isInteger(seatEntry?.seat) ? seatEntry.seat : idx;
    const startStack = Number(
      seatEntry?.startStack ?? seatEntry?.initialStack ?? seatEntry?.stack ?? null,
    );
    const endStack = Number(
      seatEntry?.endStack ?? seatEntry?.finalStack ?? seatEntry?.stack ?? null,
    );
    if (Number.isFinite(startStack) && Number.isFinite(endStack)) {
      map.set(seat, endStack - startStack);
    }
  });
  return map;
}

function getSignatureEntry(signatureMap, signature) {
  if (!signatureMap.has(signature)) {
    signatureMap.set(signature, {
      allValues: [],
      allHands: [],
      byAction: new Map(),
      sampleCount: 0,
    });
  }
  return signatureMap.get(signature);
}

export function buildTrainingIndex(handHistories = [], options = {}) {
  const maxHands = options.maxHands ?? 200;
  const targetHands =
    maxHands > 0 ? handHistories.slice(Math.max(0, handHistories.length - maxHands)) : handHistories;
  const signatureMap = new Map();
  let usableHands = 0;
  let sampleCount = 0;

  targetHands.forEach((handHistory) => {
    if (!handHistory || !Array.isArray(handHistory.events)) return;
    const outcomes = buildOutcomeMap(handHistory);
    if (!outcomes.size) return;
    usableHands += 1;
    handHistory.events.forEach((event, index) => {
      const context = extractDecisionContext(handHistory, index);
      if (!context || !context.signature || !context.actionKey) return;
      const label = outcomes.get(context.seat);
      if (!Number.isFinite(label)) return;
      const entry = getSignatureEntry(signatureMap, context.signature);
      entry.allValues.push(label);
      entry.allHands.push(handHistory?.handId ?? `hand-${index}`);
      const bucket = entry.byAction.get(context.actionKey) ?? { values: [], hands: [] };
      bucket.values.push(label);
      bucket.hands.push(handHistory?.handId ?? `hand-${index}`);
      entry.byAction.set(context.actionKey, bucket);
      entry.sampleCount += 1;
      sampleCount += 1;
    });
  });

  return {
    signatureMap,
    metadata: {
      totalHands: handHistories.length,
      usableHands,
      sampleCount,
      maxHands,
    },
  };
}

const CONFIDENCE_THRESHOLDS = {
  low: 0,
  medium: 8,
  high: 25,
};

export function estimateEvForAction({ trainingIndex, signature, actionKey }) {
  const empty = {
    ev: null,
    n: 0,
    ci95: null,
    baselineEv: null,
    deltaEv: null,
    confidence: "low",
    closestHands: [],
  };
  if (!trainingIndex || !signature || !actionKey) return empty;
  const entry = trainingIndex.signatureMap.get(signature);
  if (!entry) {
    return { ...empty, baselineEv: null };
  }
  const baselineEv = entry.allValues.length ? mean(entry.allValues) : null;
  const bucket = entry.byAction.get(actionKey);
  if (!bucket || !bucket.values.length) {
    return { ...empty, baselineEv, n: bucket?.values?.length ?? 0 };
  }
  const values = bucket.values;
  const ev = mean(values);
  const stdev = sampleStdev(values);
  const n = values.length;
  const ci95 = n > 1 ? 1.96 * (stdev / Math.sqrt(n)) : null;
  const confidence =
    n >= CONFIDENCE_THRESHOLDS.high
      ? "high"
      : n >= CONFIDENCE_THRESHOLDS.medium
      ? "medium"
      : "low";
  const deltaEv = baselineEv != null ? ev - baselineEv : null;
  const closestHands = bucket.hands.slice(-3);
  return {
    ev,
    n,
    ci95,
    baselineEv,
    deltaEv,
    confidence,
    closestHands,
  };
}
