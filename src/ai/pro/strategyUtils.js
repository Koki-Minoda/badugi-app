export function normalizeLegalActions(legalActions = []) {
  return (Array.isArray(legalActions) ? legalActions : []).map((entry) => {
    if (typeof entry === "string") {
      return { type: entry.toUpperCase() };
    }
    if (entry && typeof entry === "object") {
      return {
        ...entry,
        type: String(entry.type ?? entry.action ?? "").toUpperCase(),
      };
    }
    return { type: "" };
  });
}

export function legalActionTypes(legalActions = []) {
  return normalizeLegalActions(legalActions)
    .map((entry) => entry.type)
    .filter(Boolean);
}

export function hasLegalAction(legalActions = [], type) {
  const target = String(type ?? "").toUpperCase();
  return legalActionTypes(legalActions).includes(target);
}

export function getDrawLegalAction(legalActions = []) {
  return normalizeLegalActions(legalActions).find((entry) => entry.type === "DRAW") ?? null;
}

export function getMaxDiscardCount({ legalActions = [], hand = [] } = {}) {
  const drawAction = getDrawLegalAction(legalActions);
  if (Number.isInteger(drawAction?.maxDiscard)) {
    return Math.max(0, drawAction.maxDiscard);
  }
  if (Number.isInteger(drawAction?.maxDiscardCount)) {
    return Math.max(0, drawAction.maxDiscardCount);
  }
  return Math.max(0, Array.isArray(hand) ? hand.length : 0);
}

export function clampConfidence(value, fallback = 0.5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

export function normalizeDecision(decision = null) {
  if (!decision || typeof decision !== "object") return null;
  const type = String(decision.type ?? decision.action ?? "").toUpperCase();
  if (!type) return null;
  const discardIndexes = Array.isArray(decision.discardIndexes)
    ? [...decision.discardIndexes]
    : Array.isArray(decision.drawIndexes)
      ? [...decision.drawIndexes]
      : [];
  return {
    ...decision,
    type,
    action: type,
    discardIndexes,
  };
}

export function chooseDeterministicSafeProAction({
  legalActions = [],
  hand = [],
  allowDraw = false,
} = {}) {
  const normalizedLegal = normalizeLegalActions(legalActions);
  const has = (type) => normalizedLegal.some((entry) => entry.type === type);
  if (allowDraw && has("DRAW")) {
    return {
      type: "DRAW",
      discardIndexes: [],
      reason: "safe-pat",
    };
  }
  if (has("CHECK")) return { type: "CHECK", reason: "safe-check" };
  if (has("CALL")) return { type: "CALL", reason: "safe-call" };
  if (has("FOLD")) return { type: "FOLD", reason: "safe-fold" };
  if (has("DRAW")) {
    return {
      type: "DRAW",
      discardIndexes: [],
      reason: "safe-empty-draw",
      maxDiscardCount: getMaxDiscardCount({ legalActions: normalizedLegal, hand }),
    };
  }
  return null;
}

export function sanitizeDiscardIndexes(indexes = [], maxDiscardCount = 0, handSize = 0) {
  const unique = [];
  const seen = new Set();
  indexes.forEach((index) => {
    if (!Number.isInteger(index)) return;
    if (index < 0 || index >= handSize) return;
    if (seen.has(index)) return;
    seen.add(index);
    unique.push(index);
  });
  return unique.slice(0, Math.max(0, maxDiscardCount)).sort((a, b) => a - b);
}

