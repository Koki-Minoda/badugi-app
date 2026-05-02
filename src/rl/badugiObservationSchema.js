export const BADUGI_OBSERVATION_SCHEMA_VERSION = "badugi-observation-v1";
export const BADUGI_OBSERVATION_VECTOR_SIZE = 96;
export const BADUGI_RL_ACTIONS = Object.freeze(["fold", "check", "call", "bet", "raise", "all_in"]);
export const BADUGI_RL_FALLBACK_PRIORITY = Object.freeze([
  "onnx",
  "ruleBased",
  "deterministicSafe",
]);

const RANK_VALUES = Object.freeze({
  A: 1,
  J: 11,
  Q: 12,
  K: 13,
});
const SUIT_VALUES = Object.freeze({
  C: 0,
  D: 1,
  H: 2,
  S: 3,
});
const PHASE_VALUES = Object.freeze({
  BET: 0,
  DRAW: 1,
  SHOWDOWN: 2,
});

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeNumber(value, divisor = 1, max = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return clamp01(numeric / Math.max(1, divisor || 1)) * max;
}

function parseCard(card) {
  if (Array.isArray(card) && card.length >= 2) {
    const rank = Number(card[0]);
    const suit = Number(card[1]);
    return {
      rank: Number.isFinite(rank) ? rank + 1 : 0,
      suit: Number.isFinite(suit) ? suit : 0,
    };
  }
  if (typeof card !== "string") return { rank: 0, suit: 0 };
  const match = card.trim().toUpperCase().match(/^([2-9]|10|[AJQK])([CDHS])$/);
  if (!match) return { rank: 0, suit: 0 };
  return {
    rank: RANK_VALUES[match[1]] ?? Number(match[1]),
    suit: SUIT_VALUES[match[2]] ?? 0,
  };
}

function getPlayerSeatIndex(player = {}, fallback = null) {
  const candidates = [player.seatIndex, player.seat, player.index, fallback];
  return candidates.find((candidate) => Number.isInteger(candidate)) ?? null;
}

function getActor(state = {}, seatIndex = null) {
  const players = Array.isArray(state.players) ? state.players : [];
  if (Number.isInteger(seatIndex)) {
    return players[seatIndex] ?? players.find((player) => getPlayerSeatIndex(player) === seatIndex) ?? null;
  }
  const playerId = state.playerId;
  if (playerId) {
    return (
      players.find(
        (player) =>
          player.id === playerId ||
          player.playerId === playerId ||
          player.tournamentPlayerId === playerId,
      ) ?? null
    );
  }
  return players[0] ?? null;
}

function sumPot(state = {}) {
  if (Number.isFinite(Number(state.pot))) return Math.max(0, Number(state.pot));
  if (Number.isFinite(Number(state.totalPot))) return Math.max(0, Number(state.totalPot));
  return (Array.isArray(state.pots) ? state.pots : []).reduce(
    (sum, pot) => sum + Math.max(0, Number(pot?.amount) || 0),
    0,
  );
}

function evaluateBadugiShape(hand = []) {
  const parsed = hand.map(parseCard).filter((card) => card.rank > 0);
  const sorted = [...parsed].sort((a, b) => a.rank - b.rank);
  const usedRanks = new Set();
  const usedSuits = new Set();
  const active = [];
  sorted.forEach((card) => {
    if (usedRanks.has(card.rank) || usedSuits.has(card.suit)) return;
    usedRanks.add(card.rank);
    usedSuits.add(card.suit);
    active.push(card);
  });
  const ranks = active.map((card) => card.rank);
  return {
    madeCards: active.length,
    rankSum: ranks.reduce((sum, rank) => sum + rank, 0),
    highestRank: ranks.length ? Math.max(...ranks) : 0,
    duplicateRankCount: Math.max(0, parsed.length - new Set(parsed.map((card) => card.rank)).size),
    duplicateSuitCount: Math.max(0, parsed.length - new Set(parsed.map((card) => card.suit)).size),
  };
}

function streetAdjustedStrength(shape = {}, drawsRemaining = 0) {
  const highRank = Number(shape.highestRank) || 13;
  const lowQuality = Math.max(0, (13 - highRank) / 12);
  if (shape.madeCards === 4) {
    const earlyCredit = 0.18 * (Math.max(0, drawsRemaining) / 3);
    const nutBonus = shape.rankSum === 10 && highRank === 4 ? 0.12 : 0;
    return clamp01(0.54 + lowQuality * 0.34 + earlyCredit + nutBonus);
  }
  if (shape.madeCards === 3) {
    return Math.min(0.72, 0.3 + lowQuality * 0.22 + 0.08 * Math.max(0, drawsRemaining));
  }
  if (shape.madeCards === 2) {
    return Math.min(0.34, 0.12 + lowQuality * 0.1 + 0.04 * Math.max(0, drawsRemaining));
  }
  return 0.05;
}

function startingHandStrength(shape = {}) {
  const madeComponent = (Number(shape.madeCards) || 0) / 4;
  const highRank = Number(shape.highestRank) || 13;
  const lowComponent = Math.max(0, (13 - highRank) / 12) * 0.25;
  const oneAwayComponent = shape.madeCards === 3 ? 0.12 : 0;
  const duplicatePenalty =
    0.06 * ((Number(shape.duplicateRankCount) || 0) + (Number(shape.duplicateSuitCount) || 0));
  return clamp01(madeComponent + lowComponent + oneAwayComponent - duplicatePenalty);
}

function potOdds(toCall = 0, pot = 0) {
  const callAmount = Math.max(0, Number(toCall) || 0);
  if (callAmount <= 0) return 0;
  return clamp01(callAmount / Math.max(callAmount, (Number(pot) || 0) + callAmount));
}

function drawEquityEstimate(shape = {}, drawsRemaining = 0) {
  const madeCards = Number(shape.madeCards) || 0;
  const highRank = Number(shape.highestRank) || 13;
  const lowQuality = Math.max(0, (13 - highRank) / 12);
  const remaining = Math.max(0, Number(drawsRemaining) || 0);
  if (remaining <= 0 || madeCards >= 4) return 0;
  if (madeCards === 3) {
    return Math.min(0.48, 0.16 + 0.08 * remaining + 0.10 * lowQuality);
  }
  if (madeCards === 2) {
    return Math.min(0.30, 0.08 + 0.045 * remaining + 0.08 * lowQuality);
  }
  return 0.05;
}

function evFeatures({
  shape = {},
  features = {},
  drawsRemaining = 0,
  toCall = 0,
  pot = 0,
} = {}) {
  const strength = streetAdjustedStrength(shape, drawsRemaining);
  const drawEquity = drawEquityEstimate(shape, drawsRemaining);
  const positionBonus = features.isButton ? 0.04 : -0.02;
  const opponentPatAdjustment = -0.10 * (Number(features.opponentPatRate) || 0);
  const estimatedEquity = clamp01(strength + drawEquity + positionBonus + opponentPatAdjustment);
  const callAmount = Math.max(0, Number(toCall) || 0);
  const foldEquity = clamp01(Number(features.opponentFoldability) || 0);
  const futureStreetValue = futureStreetValueEstimate({
    shape,
    features,
    drawsRemaining,
    toCall: callAmount,
    pot,
  });
  const showdownCallEV = callAmount > 0
    ? estimatedEquity * ((Number(pot) || 0) + callAmount) - callAmount
    : estimatedEquity * (Number(pot) || 0);
  const callEV = showdownCallEV + futureStreetValue;
  const raiseCost = callAmount + 1;
  const raisePot = (Number(pot) || 0) + raiseCost;
  const raiseEV =
    foldEquity * (Number(pot) || 0) +
    (1 - foldEquity) * (estimatedEquity * raisePot - raiseCost + futureStreetValue * 0.65);
  return {
    estimatedEquity,
    potOdds: potOdds(callAmount, pot),
    callEV,
    raiseEV,
    drawEquity,
    futureStreetValue,
    cheapDrawContinueValue: Math.max(0, callEV),
    foldEquity,
  };
}

function futureStreetValueEstimate({
  shape = {},
  features = {},
  drawsRemaining = 0,
  toCall = 0,
  pot = 0,
} = {}) {
  const madeCards = Number(shape.madeCards) || 0;
  const remaining = Math.max(0, Number(drawsRemaining) || 0);
  if (remaining <= 0 || madeCards >= 4) return 0;
  const drawEquity = drawEquityEstimate(shape, remaining);
  if (drawEquity <= 0) return 0;
  const callAmount = Math.max(0, Number(toCall) || 0);
  const potAfterCall = (Number(pot) || 0) + callAmount;
  const futureBetSize = Number(features.drawRound) + 1 >= 2 ? 2 : 1;
  const impliedBets = futureBetSize * (1 + 0.35 * Math.max(0, remaining - 1));
  const positionBonus = features.isButton ? 0.18 : 0;
  const opponentDrawBonus = Number(features.opponentLastDrawAverage) >= 2 ? 0.12 : 0;
  const patPressureDiscount = 0.18 * (Number(features.opponentPatRate) || 0);
  const aggressionDiscount =
    madeCards <= 2 ? 0.10 * (Number(features.opponentAggressionRate) || 0) : 0;
  const priceDiscount = potOdds(callAmount, pot) * Math.max(0.25, 1 - 0.14 * remaining);
  const shapeMultiplier = madeCards === 3 ? 1.25 : 0.75;
  const rawValue =
    drawEquity *
    shapeMultiplier *
    (potAfterCall + impliedBets) *
    (1 + positionBonus + opponentDrawBonus);
  const futureCost = callAmount * priceDiscount + aggressionDiscount + patPressureDiscount;
  return Math.max(0, Math.min(3, rawValue - futureCost));
}

function average(values = []) {
  const numeric = values.map(Number).filter(Number.isFinite);
  if (!numeric.length) return 0;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function actionMask(legalActions = []) {
  const legal = new Set(
    (Array.isArray(legalActions) ? legalActions : []).map((action) => String(action).toLowerCase()),
  );
  return BADUGI_RL_ACTIONS.map((action) => (legal.has(action) || legal.has(action.toUpperCase()) ? 1 : 0));
}

export function buildBadugiObservationPayload({
  state = {},
  seatIndex = null,
  playerId = null,
  legalActions = [],
} = {}) {
  const actor = getActor({ ...state, playerId }, seatIndex);
  const players = Array.isArray(state.players) ? state.players : [];
  const actorSeat = getPlayerSeatIndex(actor ?? {}, seatIndex);
  const hand = Array.isArray(actor?.hand) ? actor.hand : [];
  const shape = evaluateBadugiShape(hand);
  const pot = sumPot(state);
  const maxStack = Math.max(
    1,
    ...players.map((player) => Number(player?.stack) || 0),
    Number(actor?.stack) || 0,
  );
  const drawRound = Number(state.drawRoundIndex ?? state.drawRound ?? state.round ?? 0) || 0;
  const maxDrawRounds = Number(state.maxDrawRounds ?? state.metadata?.maxDrawRounds ?? 3) || 3;
  const phase = String(state.street ?? state.phase ?? "BET").toUpperCase();
  const drawsRemaining = Math.max(0, maxDrawRounds - drawRound);
  const betThisRound = Number(actor?.betThisRound ?? actor?.bet ?? 0) || 0;
  const currentBet = Math.max(0, Number(state.currentBet ?? state.metadata?.currentBet ?? 0) || 0);
  const toCall = Math.max(0, Number(state.toCall ?? state.metadata?.toCall ?? currentBet - betThisRound) || 0);
  const activeOpponents = players.filter((player, index) => {
    const seat = getPlayerSeatIndex(player, index);
    return seat !== actorSeat && !player?.folded && !player?.sittingOut;
  });
  const opponentLastDrawAverage =
    activeOpponents.reduce((sum, player) => sum + (Number(player?.lastDrawCount) || 0), 0) /
    Math.max(1, activeOpponents.length);
  const opponentAggressionAverage = average(
    activeOpponents.map(
      (player) =>
        player?.aggressionRate ??
        player?.stats?.aggressionRate ??
        player?.stats?.raiseRate ??
        player?.profile?.aggressionRate,
    ),
  );
  const opponentPassivityAverage = opponentAggressionAverage
    ? clamp01(1 - opponentAggressionAverage)
    : average(activeOpponents.map((player) => player?.passivityRate ?? player?.stats?.callRate));
  const opponentPatRateAverage = average(
    activeOpponents.map((player) => player?.patRate ?? player?.stats?.patRate),
  );
  const opponentFoldabilityAverage = average(
    activeOpponents.map((player) => player?.foldRate ?? player?.stats?.foldRate),
  );
  const opponentBluffFrequencyAverage = average(
    activeOpponents.map((player) => player?.bluffFrequency ?? player?.profile?.bluffFrequency),
  );
  const isFinalBetRound = phase === "BET" && drawRound >= maxDrawRounds;
  const opponentDrawPressure = isFinalBetRound
    ? opponentLastDrawAverage >= 2
      ? 0.16
      : opponentLastDrawAverage >= 1
      ? 0.06
      : -0.08
    : 0;

  return {
    schemaVersion: BADUGI_OBSERVATION_SCHEMA_VERSION,
    vectorSize: BADUGI_OBSERVATION_VECTOR_SIZE,
    variantId: state.variantId ?? state.metadata?.variantId ?? "D03",
    seatIndex: actorSeat,
    legalActions: [...legalActions],
    hand,
    features: {
      madeCards: shape.madeCards,
      rankSum: shape.rankSum,
      highestRank: shape.highestRank,
      duplicateRankCount: shape.duplicateRankCount,
      duplicateSuitCount: shape.duplicateSuitCount,
      drawRound,
      maxDrawRounds,
      drawsRemaining,
      phase,
      pot,
      stack: Number(actor?.stack) || 0,
      betThisRound,
      toCall,
      currentBet,
      raiseCount: Math.max(0, Number(state.raiseCountTable ?? state.raiseCount ?? 0) || 0),
      isButton: actorSeat === state.dealerIndex || actorSeat === state.dealerIdx ? 1 : 0,
      isActing: actorSeat === state.actingPlayerIndex || actorSeat === state.turn ? 1 : 0,
      activeOpponentCount: activeOpponents.length,
      opponentStackAverage:
        activeOpponents.reduce((sum, player) => sum + (Number(player?.stack) || 0), 0) /
        Math.max(1, activeOpponents.length),
      opponentLastDrawAverage,
      streetAdjustedStrength: streetAdjustedStrength(shape, drawsRemaining),
      startingHandStrength: startingHandStrength(shape),
      potOdds: potOdds(toCall, pot),
      oneAway: shape.madeCards === 3 ? 1 : 0,
      opponentDrawPressure,
      isFinalBetRound: isFinalBetRound ? 1 : 0,
      weakFinalBadugi: isFinalBetRound && shape.madeCards === 4 && shape.highestRank >= 11 ? 1 : 0,
      opponentAggressionRate: opponentAggressionAverage,
      opponentPassivityRate: opponentPassivityAverage,
      opponentPatRate: opponentPatRateAverage,
      opponentAverageDrawCount: opponentLastDrawAverage,
      opponentFoldability: opponentFoldabilityAverage,
      opponentBluffFrequency: opponentBluffFrequencyAverage,
      maxStack,
    },
  };
}

export function buildBadugiObservationVector(input = {}) {
  if (Array.isArray(input)) return normalizeBadugiObservationVector(input);
  if (ArrayBuffer.isView(input)) return normalizeBadugiObservationVector(Array.from(input));
  if (Array.isArray(input.stateVector)) return normalizeBadugiObservationVector(input.stateVector);

  const payload = input.schemaVersion ? input : buildBadugiObservationPayload(input);
  const features = payload.features ?? {};
  const vector = new Array(BADUGI_OBSERVATION_VECTOR_SIZE).fill(0);
  const hand = Array.isArray(payload.hand) ? payload.hand : [];

  hand.slice(0, 4).forEach((card, index) => {
    const parsed = parseCard(card);
    vector[index * 2] = normalizeNumber(parsed.rank, 13);
    vector[index * 2 + 1] = normalizeNumber(parsed.suit, 3);
  });

  vector[8] = normalizeNumber(features.drawRound, features.maxDrawRounds || 3);
  vector[9] = normalizeNumber(features.stack, features.maxStack || 1);
  vector[10] = normalizeNumber(features.opponentStackAverage, features.maxStack || 1);
  vector[11] = normalizeNumber(features.pot, Math.max(1, (features.maxStack || 1) * 6));
  vector[12] = normalizeNumber(features.betThisRound, features.maxStack || 1);
  vector[13] = normalizeNumber(features.toCall, features.maxStack || 1);
  vector[14] = normalizeNumber(features.currentBet, features.maxStack || 1);
  vector[15] = normalizeNumber(features.raiseCount, 4);
  vector[16] = normalizeNumber(features.drawsRemaining, features.maxDrawRounds || 3);
  vector[17] = normalizeNumber(PHASE_VALUES[features.phase] ?? 0, 2);
  vector[18] = normalizeNumber(features.opponentLastDrawAverage, 4);
  vector[19] = features.isButton ? 1 : 0;
  vector[20] = features.isActing ? 1 : 0;
  vector[21] = normalizeNumber(features.activeOpponentCount, 5);
  vector[22] = normalizeNumber(features.madeCards, 4);
  vector[23] = normalizeNumber(features.rankSum, 40);
  vector[24] = normalizeNumber(features.highestRank, 13);
  vector[25] = normalizeNumber(features.duplicateRankCount, 3);
  vector[26] = normalizeNumber(features.duplicateSuitCount, 3);
  vector[27] = normalizeNumber(features.startingHandStrength, 1);
  vector[28] = normalizeNumber(features.potOdds, 1);
  vector[29] = features.isButton ? 0 : 1;
  vector[30] = normalizeNumber(features.toCall, features.maxStack || 1);
  vector[31] = features.oneAway ? 1 : 0;
  actionMask(payload.legalActions).forEach((value, index) => {
    vector[32 + index] = value;
  });
  vector[38] = normalizeNumber(features.streetAdjustedStrength, 1);
  vector[39] = Number.isFinite(Number(features.opponentDrawPressure))
    ? Math.max(-1, Math.min(1, Number(features.opponentDrawPressure)))
    : 0;
  vector[40] = features.isFinalBetRound ? 1 : 0;
  vector[41] = features.weakFinalBadugi ? 1 : 0;
  vector[42] = normalizeNumber(features.opponentAggressionRate, 1);
  vector[43] = normalizeNumber(features.opponentPassivityRate, 1);
  vector[44] = normalizeNumber(features.opponentPatRate, 1);
  vector[45] = normalizeNumber(features.opponentAverageDrawCount, 4);
  vector[46] = normalizeNumber(features.opponentFoldability, 1);
  vector[47] = normalizeNumber(features.opponentBluffFrequency, 1);
  const ev = evFeatures({
    shape: {
      madeCards: features.madeCards,
      highestRank: features.highestRank,
      duplicateRankCount: features.duplicateRankCount,
      duplicateSuitCount: features.duplicateSuitCount,
    },
    features,
    drawsRemaining: features.drawsRemaining,
    toCall: features.toCall,
    pot: features.pot,
  });
  vector[48] = normalizeNumber(ev.estimatedEquity, 1);
  vector[49] = normalizeNumber(ev.potOdds, 1);
  vector[50] = Math.max(-1, Math.min(1, ev.callEV / 10));
  vector[51] = Math.max(-1, Math.min(1, ev.raiseEV / 10));
  vector[52] = normalizeNumber(ev.drawEquity, 1);
  vector[53] = normalizeNumber(ev.foldEquity, 1);
  vector[54] = normalizeNumber(ev.futureStreetValue, 3);
  vector[55] = normalizeNumber(ev.cheapDrawContinueValue, 3);

  return vector;
}

export function normalizeBadugiObservationVector(vector = []) {
  const source = Array.from(vector, (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  });
  if (source.length === BADUGI_OBSERVATION_VECTOR_SIZE) return source;
  if (source.length > BADUGI_OBSERVATION_VECTOR_SIZE) {
    return source.slice(0, BADUGI_OBSERVATION_VECTOR_SIZE);
  }
  return source.concat(new Array(BADUGI_OBSERVATION_VECTOR_SIZE - source.length).fill(0));
}

export function isValidBadugiObservationVector(vector = []) {
  return Array.isArray(vector) && vector.length === BADUGI_OBSERVATION_VECTOR_SIZE;
}

export function chooseDeterministicSafeAction(validActions = []) {
  const normalized = (Array.isArray(validActions) ? validActions : []).map((action) =>
    String(action).toLowerCase(),
  );
  const legal = new Set(normalized);
  const priority = ["check", "call", "fold", "bet", "raise", "all_in"];
  return priority.find((action) => legal.has(action)) ?? normalized[0] ?? null;
}
