export const DRAW_OBSERVATION_SCHEMA_VERSION = "draw-observation-v1";
export const DRAW_OBSERVATION_VECTOR_SIZE = 96;
export const DRAW_RL_ACTIONS = Object.freeze([
  "fold",
  "check",
  "call",
  "bet",
  "raise",
  "draw_0",
  "draw_1",
  "draw_2",
  "draw_3",
  "draw_4",
  "draw_5",
]);

export const DRAW_VARIANT_FEATURES = Object.freeze({
  badugi: Object.freeze({ badugi: 1, low27: 0, lowA5: 0 }),
  "low-27": Object.freeze({ badugi: 0, low27: 1, lowA5: 0 }),
  "low-a5": Object.freeze({ badugi: 0, low27: 0, lowA5: 1 }),
});

const VARIANT_RL_CONFIG = Object.freeze({
  D03: Object.freeze({ family: "badugi", handSize: 4, drawRounds: 3 }),
  D01: Object.freeze({ family: "low-27", handSize: 5, drawRounds: 3 }),
  D02: Object.freeze({ family: "low-a5", handSize: 5, drawRounds: 3 }),
  S01: Object.freeze({ family: "low-27", handSize: 5, drawRounds: 1 }),
  S02: Object.freeze({ family: "low-a5", handSize: 5, drawRounds: 1 }),
});

const RANK_VALUES = Object.freeze({ A: 14, J: 11, Q: 12, K: 13 });
const SUIT_VALUES = Object.freeze({ C: 0, D: 1, H: 2, S: 3 });
const PHASE_VALUES = Object.freeze({ BET: 0, DRAW: 1, SHOWDOWN: 2 });

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function norm(value, divisor = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return clamp01(numeric / Math.max(1, divisor || 1));
}

function parseCard(card, { aceLow = false } = {}) {
  if (typeof card !== "string") return { rank: 0, suit: 0 };
  const match = card.trim().toUpperCase().match(/^([2-9]|10|[AJQK])([CDHS])$/);
  if (!match) return { rank: 0, suit: 0 };
  const rawRank = RANK_VALUES[match[1]] ?? Number(match[1]);
  return {
    rank: aceLow && rawRank === 14 ? 1 : rawRank,
    rawRank,
    suit: SUIT_VALUES[match[2]] ?? 0,
  };
}

function getVariantConfig(variantId, fallback = {}) {
  return (
    VARIANT_RL_CONFIG[variantId] ??
    Object.freeze({
      family: fallback.family ?? "low-27",
      handSize: fallback.handSize ?? 5,
      drawRounds: fallback.drawRounds ?? 3,
    })
  );
}

function evaluateBadugiShape(hand = []) {
  const parsed = hand.map((card) => parseCard(card, { aceLow: true })).filter((card) => card.rank);
  const active = [];
  const usedRanks = new Set();
  const usedSuits = new Set();
  [...parsed].sort((a, b) => a.rank - b.rank).forEach((card) => {
    if (usedRanks.has(card.rank) || usedSuits.has(card.suit)) return;
    usedRanks.add(card.rank);
    usedSuits.add(card.suit);
    active.push(card);
  });
  const ranks = active.map((card) => card.rank);
  return {
    madeCards: active.length,
    highestRank: ranks.length ? Math.max(...ranks) : 0,
    rankSum: ranks.reduce((sum, rank) => sum + rank, 0),
    duplicateRanks: Math.max(0, parsed.length - new Set(parsed.map((card) => card.rank)).size),
    duplicateSuits: Math.max(0, parsed.length - new Set(parsed.map((card) => card.suit)).size),
    straight: 0,
    flush: 0,
  };
}

function isStraight(ranks = []) {
  if (ranks.length < 5) return false;
  const sorted = [...new Set(ranks)].sort((a, b) => a - b);
  return sorted.length === 5 && sorted[4] - sorted[0] === 4;
}

function evaluateLowballShape(hand = [], family = "low-27") {
  const aceLow = family === "low-a5";
  const parsed = hand.map((card) => parseCard(card, { aceLow })).filter((card) => card.rank);
  const ranks = parsed.map((card) => card.rank);
  const suits = parsed.map((card) => card.suit);
  const duplicateRanks = Math.max(0, parsed.length - new Set(ranks).size);
  const flush = parsed.length >= 5 && new Set(suits).size === 1 ? 1 : 0;
  const straight = isStraight(ranks) ? 1 : 0;
  const penalties = family === "low-27" ? duplicateRanks + flush + straight : duplicateRanks;
  const madeCards = Math.max(0, Math.min(5, parsed.length - duplicateRanks - (penalties > duplicateRanks ? 1 : 0)));
  const sortedHighToLow = [...ranks].sort((a, b) => b - a);
  return {
    madeCards,
    highestRank: sortedHighToLow[0] ?? 0,
    rankSum: ranks.reduce((sum, rank) => sum + rank, 0),
    duplicateRanks,
    duplicateSuits: Math.max(0, parsed.length - new Set(suits).size),
    straight,
    flush,
  };
}

function getActor(state = {}, seatIndex = null) {
  const players = Array.isArray(state.players) ? state.players : [];
  return Number.isInteger(seatIndex) ? players[seatIndex] ?? null : players[state.actingPlayerIndex] ?? players[0] ?? null;
}

function sumPot(state = {}) {
  if (Number.isFinite(Number(state.pot))) return Math.max(0, Number(state.pot));
  return (Array.isArray(state.pots) ? state.pots : []).reduce(
    (sum, pot) => sum + Math.max(0, Number(pot?.amount) || 0),
    0,
  );
}

function legalActionMask(legalActions = []) {
  const legal = new Set((Array.isArray(legalActions) ? legalActions : []).map((action) => String(action).toLowerCase()));
  return DRAW_RL_ACTIONS.map((action) => (legal.has(action) || legal.has(action.toUpperCase()) ? 1 : 0));
}

export function getDrawVariantRlConfig(variantId) {
  return VARIANT_RL_CONFIG[variantId] ? { ...VARIANT_RL_CONFIG[variantId] } : null;
}

export function buildDrawObservationPayload({
  state = {},
  seatIndex = null,
  variantId = null,
  legalActions = [],
  family = null,
} = {}) {
  const resolvedVariantId = variantId ?? state.variantId ?? state.metadata?.variantId ?? "D01";
  const config = getVariantConfig(resolvedVariantId, { family });
  const actor = getActor(state, seatIndex);
  const hand = Array.isArray(actor?.hand) ? actor.hand : [];
  const shape =
    config.family === "badugi" ? evaluateBadugiShape(hand) : evaluateLowballShape(hand, config.family);
  const players = Array.isArray(state.players) ? state.players : [];
  const maxStack = Math.max(1, ...players.map((player) => Number(player?.stack) || 0), Number(actor?.stack) || 0);
  const pot = sumPot(state);
  const drawRound = Number(state.drawRoundIndex ?? state.drawRound ?? 0) || 0;
  const phase = String(state.street ?? state.phase ?? "BET").toUpperCase();
  const variantFeatures = DRAW_VARIANT_FEATURES[config.family] ?? DRAW_VARIANT_FEATURES["low-27"];

  return {
    schemaVersion: DRAW_OBSERVATION_SCHEMA_VERSION,
    vectorSize: DRAW_OBSERVATION_VECTOR_SIZE,
    variantId: resolvedVariantId,
    family: config.family,
    hand,
    legalActions: [...legalActions],
    features: {
      ...variantFeatures,
      handSize: config.handSize,
      maxDrawRounds: config.drawRounds,
      drawRound,
      drawsRemaining: Math.max(0, config.drawRounds - drawRound),
      phase,
      madeCards: shape.madeCards,
      highestRank: shape.highestRank,
      rankSum: shape.rankSum,
      duplicateRanks: shape.duplicateRanks,
      duplicateSuits: shape.duplicateSuits,
      straight: shape.straight,
      flush: shape.flush,
      stack: Number(actor?.stack) || 0,
      betThisRound: Number(actor?.bet ?? actor?.betThisRound ?? 0) || 0,
      pot,
      currentBet: Number(state.metadata?.currentBet ?? state.currentBet ?? 0) || 0,
      raiseCount: Number(state.metadata?.raiseCountThisRound ?? state.raiseCount ?? 0) || 0,
      maxStack,
    },
  };
}

export function buildDrawObservationVector(input = {}) {
  if (Array.isArray(input)) return normalizeDrawObservationVector(input);
  if (ArrayBuffer.isView(input)) return normalizeDrawObservationVector(Array.from(input));
  if (Array.isArray(input.stateVector)) return normalizeDrawObservationVector(input.stateVector);
  const payload = input.schemaVersion ? input : buildDrawObservationPayload(input);
  const features = payload.features ?? {};
  const config = getVariantConfig(payload.variantId, { family: payload.family });
  const aceLow = config.family === "low-a5" || config.family === "badugi";
  const vector = new Array(DRAW_OBSERVATION_VECTOR_SIZE).fill(0);

  (payload.hand ?? []).slice(0, 5).forEach((card, index) => {
    const parsed = parseCard(card, { aceLow });
    vector[index * 2] = norm(parsed.rank, 14);
    vector[index * 2 + 1] = norm(parsed.suit, 3);
  });

  vector[12] = norm(features.drawRound, features.maxDrawRounds || 3);
  vector[13] = norm(features.drawsRemaining, features.maxDrawRounds || 3);
  vector[14] = norm(PHASE_VALUES[features.phase] ?? 0, 2);
  vector[15] = norm(features.madeCards, features.handSize || 5);
  vector[16] = norm(features.highestRank, 14);
  vector[17] = norm(features.rankSum, 60);
  vector[18] = norm(features.duplicateRanks, 4);
  vector[19] = norm(features.duplicateSuits, 4);
  vector[20] = features.straight ? 1 : 0;
  vector[21] = features.flush ? 1 : 0;
  vector[22] = norm(features.stack, features.maxStack || 1);
  vector[23] = norm(features.betThisRound, features.maxStack || 1);
  vector[24] = norm(features.pot, Math.max(1, (features.maxStack || 1) * 6));
  vector[25] = norm(features.currentBet, features.maxStack || 1);
  vector[26] = norm(features.raiseCount, 4);
  vector[40] = features.badugi ? 1 : 0;
  vector[41] = features.low27 ? 1 : 0;
  vector[42] = features.lowA5 ? 1 : 0;
  legalActionMask(payload.legalActions).forEach((value, index) => {
    vector[48 + index] = value;
  });
  return vector;
}

export function normalizeDrawObservationVector(vector = []) {
  const source = Array.from(vector, (value) => (Number.isFinite(Number(value)) ? Number(value) : 0));
  if (source.length === DRAW_OBSERVATION_VECTOR_SIZE) return source;
  if (source.length > DRAW_OBSERVATION_VECTOR_SIZE) return source.slice(0, DRAW_OBSERVATION_VECTOR_SIZE);
  return source.concat(new Array(DRAW_OBSERVATION_VECTOR_SIZE - source.length).fill(0));
}

export function isDrawRlVariant(variantId) {
  return Boolean(VARIANT_RL_CONFIG[variantId]);
}

export function wrapRuleBasedDrawDecision({ engine, state, seatIndex } = {}) {
  if (!engine || typeof engine.chooseCpuAction !== "function") return null;
  const decision = engine.chooseCpuAction(state, seatIndex);
  if (!decision) return null;
  return {
    ...decision,
    source: "rule-based-draw",
    metadata: {
      ...(decision.metadata ?? {}),
      rlFallback: "ruleBased",
      replaceableByRl: true,
    },
  };
}
