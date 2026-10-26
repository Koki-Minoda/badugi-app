// Offline translation of SixMaxDrawLowballEnv._obs_for. Do not wire into live
// inference until the state adapter and model-strength gate are validated.
const SIZE = 96;
const SEATS = 6;
const ACTIONS = ["fold", "check", "call", "bet", "raise", "draw_0", "draw_1", "draw_2", "draw_3", "draw_4", "draw_5"];
const mean = (values, fallback = 0) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const effectiveRank = (rank, family) => family === "low-a5" && rank === 14 ? 1 : rank;

function isStraight(cards, family) {
  const ranks = [...new Set(cards.map(([rank]) => effectiveRank(rank, family)))].sort((a, b) => a - b);
  return ranks.length === 5 && ranks[4] - ranks[0] === 4;
}

function duplicateCategory(counts) {
  const groups = [...counts.values()].sort((a, b) => b - a).join(",");
  return { "4,1": 7, "3,2": 6, "3,1,1": 3, "2,2,1": 2, "2,1,1,1": 1 }[groups] ?? 0;
}

function evaluateLowball(cards, family) {
  const ranks = cards.map(([rank]) => effectiveRank(rank, family));
  const suits = cards.map(([, suit]) => suit);
  const counts = new Map();
  ranks.forEach((rank) => counts.set(rank, (counts.get(rank) ?? 0) + 1));
  const straight = isStraight(cards, family);
  const flush = new Set(suits).size === 1;
  let category = duplicateCategory(counts);
  if (family === "low-27") {
    if (straight && flush) category = Math.max(category, 8);
    else if (flush) category = Math.max(category, 5);
    else if (straight) category = Math.max(category, 4);
  }
  const highestRank = Math.max(...ranks);
  const rankSum = ranks.reduce((sum, rank) => sum + rank, 0);
  const madeCards = counts.size;
  const categoryPenalty = Math.min(0.7, category * 0.09);
  const rankQuality = Math.max(0, 1 - ((highestRank - 5) / 9) * 0.55 - (rankSum / 70) * 0.25);
  return {
    category, madeCards, highestRank, rankSum, straight, flush,
    duplicateRanks: ranks.length - counts.size,
    duplicateSuits: suits.length - new Set(suits).size,
    strength: clamp(rankQuality - categoryPenalty + madeCards * 0.025, 0, 1),
  };
}

function mustDiscard(rank, family) {
  return family === "low-27" ? rank >= 10 : effectiveRank(rank, family) > 8;
}

function betterKeep(candidate, previous) {
  if (!previous) return true;
  if (candidate.valid !== previous.valid) return candidate.valid > previous.valid;
  if (candidate.highest !== previous.highest) return candidate.highest < previous.highest;
  if (candidate.sum !== previous.sum) return candidate.sum < previous.sum;
  for (let index = 0; index < candidate.indices.length; index += 1) {
    if (candidate.indices[index] !== previous.indices[index]) {
      return candidate.indices[index] > previous.indices[index];
    }
  }
  return false;
}

function discardIndexes(cards, family) {
  const full = evaluateLowball(cards, family);
  let best = null;
  for (let keepSize = Math.min(5, cards.length); keepSize >= 1; keepSize -= 1) {
    for (let mask = 1; mask < (1 << cards.length); mask += 1) {
      const indices = cards.map((_, index) => index).filter((index) => mask & (1 << index));
      if (indices.length !== keepSize) continue;
      const kept = indices.map((index) => cards[index]);
      const features = evaluateLowball(kept, family);
      const duplicateFree = features.duplicateRanks === 0;
      const flushSafe = family === "low-a5" || new Set(kept.map(([, suit]) => suit)).size > 1 || kept.length < 5;
      const straightSafe = family === "low-a5" || !isStraight(kept, family) || kept.length < 5;
      const score = { valid: duplicateFree && flushSafe && straightSafe ? 1 : 0,
        highest: features.highestRank, sum: features.rankSum, indices };
      if (betterKeep(score, best)) best = score;
    }
    if (best?.valid) break;
  }
  const keep = new Set(best?.indices ?? []);
  for (const index of keep) if (mustDiscard(cards[index][0], family)) keep.delete(index);
  const discards = cards.map((_, index) => index).filter((index) => !keep.has(index));
  if (full.category === 0 && full.highestRank <= (family === "low-27" ? 7 : 5)) return [];
  return discards;
}

export function buildDrawTrainingObservationV1({ state, seatIndex, legalActions = [] }) {
  if (!Array.isArray(state?.players) || state.players.length !== SEATS ||
      !Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= SEATS) {
    throw new TypeError("Six-max draw training observation requires six players and a valid seat");
  }
  const players = state.players;
  const hero = players[seatIndex];
  const hand = hero.hand;
  if (!Array.isArray(hand) || hand.length !== 5 || !hand.every((card) =>
    Array.isArray(card) && card.length === 2 && Number.isInteger(card[0]) &&
    card[0] >= 2 && card[0] <= 14 && Number.isInteger(card[1]) && card[1] >= 0 && card[1] <= 3)) {
    throw new TypeError("Six-max draw training observation requires five numeric rank/suit cards");
  }
  const family = state.family;
  if (family !== "low-27" && family !== "low-a5") throw new TypeError("Unsupported draw family");
  const phase = state.phase;
  const round = state.drawRoundIndex;
  const maxDraws = state.maxDraws;
  const dealer = state.dealerIndex;
  const opponents = players.filter((player, index) => index !== seatIndex && !player.folded);
  const nOpps = opponents.length;
  const pos = ((seatIndex - dealer - 1 + SEATS) % SEATS);
  const posFraction = pos / (SEATS - 1);
  const queue = phase === "DRAW" && state.drawOrder ? state.drawOrder : state.betQueue;
  const queueIndex = queue.indexOf(seatIndex);
  const playersYet = queueIndex < 0 ? 0 : queue.slice(queueIndex + 1).filter((index) => !players[index].folded).length;
  const bet = hero.betThisRound;
  const currentBet = state.currentBet;
  const toCall = Math.max(0, currentBet - bet);
  const pot = state.pot;
  const potOdds = toCall > 0 ? toCall / Math.max(1, pot + toCall) : 0;
  const features = evaluateLowball(hand, family);
  const oppLast = mean(opponents.map((player) => player.lastDrawCount));
  const oppHistory = [0, 1, 2].map((index) => mean(opponents.map((player) => player.drawHistory[index])));
  const oppTotal = mean(opponents.map((player) => player.totalDraws));
  const oppOpened = opponents.some((player) => player.openedCurrentRound);
  const oppBetHistory = [0, 1, 2].map((index) => opponents.some((player) => player.betHistory[index]));
  const oppStack = mean(opponents.map((player) => player.stack), 100);
  const v = new Array(SIZE).fill(0);
  v[0] = round / Math.max(1, maxDraws);
  v[1] = phase === "BET" ? 1 : 0;
  v[2] = phase === "DRAW" ? 1 : 0;
  v[3] = potOdds;
  v[4] = Math.min(pot, 100) / 100;
  v[5] = seatIndex === dealer ? 1 : 0;
  v[6] = phase === "BET" && round >= maxDraws ? 1 : 0;
  v[7] = oppLast / 5;
  v[8] = 0.05;
  v[9] = 0.54;
  v[10] = 0.5;
  v[11] = 0.76;
  v[12] = (maxDraws - round) / Math.max(1, maxDraws);
  v[13] = oppHistory[0] / 5;
  v[14] = oppHistory[1] / 5;
  v[15] = features.madeCards / 5;
  v[16] = features.highestRank / 14;
  v[17] = features.rankSum / 70;
  v[18] = features.duplicateRanks / 4;
  v[19] = features.duplicateSuits / 4;
  v[20] = features.straight ? 1 : 0;
  v[21] = features.flush ? 1 : 0;
  v[22] = features.strength;
  v[23] = oppHistory[2] / 5;
  v[24] = Math.min(1, oppTotal / 15);
  v[25] = currentBet / 20;
  v[26] = state.raiseCount / 4;
  v[27] = oppLast === 0 && round > 0 ? 1 : 0;
  v[28] = oppOpened ? 1 : 0;
  v[29] = oppBetHistory[0] ? 1 : 0;
  v[30] = oppBetHistory[1] ? 1 : 0;
  v[41] = family === "low-27" ? 1 : 0;
  v[42] = family === "low-a5" ? 1 : 0;
  const discards = discardIndexes(hand, family);
  const kept = hand.filter((_, index) => !discards.includes(index));
  const discount = Math.max(0.4, 1 - discards.length * 0.12);
  const keptFeatures = kept.length ? evaluateLowball(kept, family) : null;
  const drawTargetStrength = keptFeatures ? keptFeatures.strength * discount : 0;
  const drawTargetRank = keptFeatures ? keptFeatures.highestRank / 14 : 1;
  const isA5 = family === "low-a5";
  const premium = new Set(isA5 ? [14, 2, 3, 4, 5] : [2, 3, 4, 5]);
  const blocker = isA5 ? 14 : 2;
  const originalRaiser = opponents.find((player) => player.betHistory[0]);
  const raiserSeat = originalRaiser ? players.indexOf(originalRaiser) : -1;
  v[31] = drawTargetStrength;
  v[32] = discards.length / 5;
  v[33] = nOpps / 5;
  v[34] = posFraction;
  v[35] = playersYet / 5;
  v[36] = drawTargetStrength;
  v[37] = drawTargetRank;
  v[38] = hand.filter(([rank]) => premium.has(rank)).length / 5;
  v[39] = hand.filter(([rank]) => rank === blocker).length / 4;
  v[43] = raiserSeat < 0 ? 0 : ((raiserSeat - dealer - 1 + SEATS) % SEATS) / (SEATS - 1);
  v[44] = Math.max(0, (nOpps - 1) / 5);
  v[45] = oppOpened ? 1 : 0;
  const remaining = Math.max(1, maxDraws - round + (phase === "BET" ? 1 : 0));
  v[46] = hero.stack / Math.max(1, 4 * 4 * remaining);
  v[47] = round >= 2 ? 1 : 0;
  ACTIONS.forEach((action, index) => { v[48 + index] = legalActions.includes(action) ? 1 : 0; });
  v[59] = hero.raisedPredraw ? 1 : 0;
  v[60] = hero.betHistory[0] ? 1 : 0;
  v[61] = hero.betHistory[1] ? 1 : 0;
  v[62] = !hero.betHistory[0] && !oppBetHistory[0] && round >= 1 ? 1 : 0;
  v[63] = !hero.betHistory[1] && !oppBetHistory[1] && round >= 2 ? 1 : 0;
  v[64] = playersYet > 0 ? 1 : 0;
  v[65] = hero.drawHistory[0] / 5;
  v[66] = hero.drawHistory[1] / 5;
  v[67] = (oppHistory[0] - oppHistory[1]) / 5;
  v[68] = (oppHistory[1] - oppHistory[2]) / 5;
  v[69] = (oppLast - hero.lastDrawCount) / 5;
  v[70] = hero.discardedCards.filter(([rank]) => rank === blocker).length / 4;
  v[71] = Math.min(1, hero.discardedCards.filter(([rank]) => premium.has(rank)).length / (isA5 ? 20 : 16));
  v[72] = 1 - oppLast / 5;
  v[73] = oppHistory.slice(0, round).filter((value) => value === 0).length / Math.max(1, maxDraws);
  v[74] = oppStack / 100;
  v[75] = hero.stack / 100;
  v[76] = Math.min(2, oppStack / Math.max(1, hero.stack)) / 2;
  v[77] = hero.stack / Math.max(1, hero.stack + opponents.reduce((sum, player) => sum + player.stack, 0));
  v[80] = maxDraws / 3;
  v[81 + pos] = 1;
  return v;
}
