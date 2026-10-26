// A direct, offline-only translation of SixMaxBadugiEnv._obs_for. Keep this
// separate from the live observation path until model behavior is evaluated.
const SIZE = 96;
const MAX_DRAWS = 3;
const MAX_BETS = 4;
const NUM_PLAYERS = 6;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const mean = (values, fallback = 0) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : fallback;

function bestBadugi(cards) {
  let best = [];
  for (let mask = 1; mask < (1 << cards.length); mask += 1) {
    const subset = cards.filter((_, index) => mask & (1 << index));
    const ranks = subset.map(([rank]) => rank);
    const suits = subset.map(([, suit]) => suit);
    if (new Set(ranks).size !== subset.length || new Set(suits).size !== subset.length) continue;
    const sorted = [...ranks].sort((a, b) => a - b);
    let better = sorted.length > best.length;
    if (sorted.length === best.length) {
      for (let index = sorted.length - 1; index >= 0; index -= 1) {
        if (sorted[index] === best[index]) continue;
        better = sorted[index] < best[index];
        break;
      }
    }
    if (better) best = sorted;
  }
  const count = best.length;
  const highestRank = count ? best[count - 1] : 13;
  const rankSum = count ? best.reduce((total, rank) => total + rank, 0) : 99;
  const isNuts = count === 4 && best.every((rank, index) => rank === index);
  const highQuality = Math.max(0, (13 - highestRank) / 13);
  let strength = 0.05;
  if (count === 4) strength = 0.55 + highQuality * 0.35 + (isNuts ? 0.1 : 0);
  else if (count === 3) strength = 0.3 + highQuality * 0.2;
  else if (count === 2) strength = 0.12 + highQuality * 0.08;
  return { count, ranks: best, highestRank, rankSum, strength: clamp(strength, 0, 1) };
}

function streetStrength(features, drawsRemaining) {
  const high = features.highestRank || 13;
  const quality = Math.max(0, (13 - high) / 12);
  if (features.count === 4) return Math.min(1, 0.54 + quality * 0.34 + 0.18 * drawsRemaining / 3);
  if (features.count === 3) return Math.min(0.72, 0.3 + quality * 0.22 + 0.08 * drawsRemaining);
  if (features.count === 2) return Math.min(0.34, 0.12 + quality * 0.1 + 0.04 * drawsRemaining);
  return 0.05;
}

function rangeEquity(features) {
  const { count, highestRank: high, rankSum: sum } = features;
  if (count >= 4) return Math.min(1, 0.62 + (13 - high) / 12 * 0.3 + Math.max(0, 22 - sum) * 0.006);
  if (count === 3) return Math.min(1, 0.36 + (13 - high) / 12 * 0.28);
  if (count === 2) return Math.min(1, 0.14 + (13 - high) / 12 * 0.15);
  return 0.04;
}

export function buildBadugiTrainingObservationV1({ state, seatIndex, legalActions = [] }) {
  if (!Array.isArray(state?.players) || state.players.length !== NUM_PLAYERS ||
      !Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= NUM_PLAYERS) {
    throw new TypeError("Six-max training observation requires six players and a valid seat index");
  }
  const vector = new Array(SIZE).fill(0);
  const players = state.players;
  const hero = players[seatIndex];
  const hand = hero.hand;
  if (!Array.isArray(hand) || hand.length !== 4 ||
      !hand.every((card) => Array.isArray(card) && card.length === 2 &&
        Number.isInteger(card[0]) && card[0] >= 0 && card[0] <= 12 &&
        Number.isInteger(card[1]) && card[1] >= 0 && card[1] <= 3)) {
    throw new TypeError("Six-max training observation requires four zero-based rank/suit cards");
  }
  const phase = state.phase;
  const drawRound = state.drawRoundIndex ?? 0;
  const dealer = state.dealerIndex;
  const currentBet = phase === "BET" ? state.currentBet : 0;
  const toCall = Math.max(0, currentBet - hero.betThisRound);
  const drawsRemaining = MAX_DRAWS - drawRound;
  const pot = state.pot;
  const isButton = seatIndex === dealer;
  const firstToAct = state.betQueue?.[0] === seatIndex;
  const posFraction = ((seatIndex - dealer - 1 + NUM_PLAYERS) % NUM_PLAYERS) / (NUM_PLAYERS - 1);
  const isFinal = phase === "BET" && drawRound >= MAX_DRAWS;
  const opponents = players.filter((player, index) => index !== seatIndex && !player.folded);
  const nOpps = opponents.length;
  const f = bestBadugi(hand);
  const oppLastDraw = mean(opponents.map((player) => player.lastDrawCount));
  const oppStack = mean(opponents.map((player) => player.stack), 100);
  const oppBet = mean(opponents.map((player) => player.betThisRound));
  const oppAggrRate = opponents.filter((player) => player.openedCurrentRound).length / Math.max(1, nOpps);
  const oppPatRate = drawRound > 0 ? opponents.filter((player) => player.lastDrawCount === 0).length / Math.max(1, nOpps) : 0;
  const potOdds = toCall > 0 ? toCall / Math.max(1, pot + toCall) : 0;
  const ranks = hand.map(([rank]) => rank);
  const suits = hand.map(([, suit]) => suit);
  const dupRanks = ranks.length - new Set(ranks).size;
  const dupSuits = suits.length - new Set(suits).size;
  hand.slice(0, 4).forEach(([rank, suit], index) => {
    vector[index * 2] = rank / 12;
    vector[index * 2 + 1] = suit / 3;
  });
  vector[8] = drawRound / MAX_DRAWS;
  vector[9] = hero.stack / 200;
  vector[10] = oppStack / 200;
  vector[11] = Math.min(pot, 400) / 400;
  vector[12] = Math.min(hero.betThisRound, 10) / 10;
  vector[13] = Math.min(oppBet, 10) / 10;
  vector[14] = Math.min(currentBet, 10) / 10;
  vector[15] = state.raiseCount / MAX_BETS;
  vector[16] = drawsRemaining / MAX_DRAWS;
  vector[17] = phase === "BET" ? 0 : 1;
  vector[18] = oppLastDraw / 4;
  vector[19] = isButton ? 1 : 0;
  vector[20] = firstToAct ? 1 : 0;
  vector[21] = posFraction;
  vector[22] = f.count / 4;
  vector[23] = Math.min(f.rankSum, 40) / 40;
  vector[24] = (f.ranks.length ? f.ranks[f.ranks.length - 1] : 13) / 13;
  vector[25] = Math.min(dupRanks, 3) / 3;
  vector[26] = Math.min(dupSuits, 3) / 3;
  vector[27] = f.strength;
  vector[28] = potOdds;
  vector[29] = firstToAct ? 0 : 1;
  vector[30] = Math.min(toCall, 10) / 10;
  vector[31] = f.count === 3 ? 1 : 0;
  const actions = phase === "DRAW" ? ["draw_0", "draw_1", "draw_2", "draw_3", "unused_4", "unused_5"] :
    ["FOLD", "CHECK", "CALL", "BET", "RAISE", "ALL_IN"];
  actions.forEach((action, index) => { vector[32 + index] = legalActions.includes(action) ? 1 : 0; });
  const street = streetStrength(f, drawsRemaining);
  const oppDrawPressure = isFinal && oppLastDraw >= 2 ? 0.08 : oppLastDraw >= 1 ? 0.03 : -0.05;
  vector[38] = street;
  vector[39] = oppDrawPressure;
  vector[40] = isFinal ? 1 : 0;
  vector[41] = isFinal && f.count === 4 && f.highestRank >= 11 ? 1 : 0;
  vector[42] = oppAggrRate;
  vector[43] = 1 - oppAggrRate;
  vector[44] = oppPatRate;
  vector[45] = oppLastDraw / 4;
  vector[46] = 0.3;
  vector[47] = 0.05;
  const betSize = drawRound >= 2 ? 4 : 2;
  const callEv = toCall > 0 ? (street * (pot + toCall) - toCall) / 10 : street * pot / 10;
  const raiseEv = (street * (pot + betSize) - betSize) / 10;
  vector[48] = street;
  vector[49] = potOdds;
  vector[50] = clamp(callEv, -1, 1);
  vector[51] = clamp(raiseEv, -1, 1);
  vector[52] = Math.max(0, (4 - f.count) * 0.12);
  vector[53] = 0.3;
  vector[54] = clamp(street * drawsRemaining * 0.25, 0, 1);
  vector[55] = clamp(Math.max(0, callEv), 0, 1);
  vector[56] = nOpps / 5;
  vector[57] = nOpps <= 1 ? 0 : Math.min(0.35, Math.max(0, 0.5 - posFraction) * 0.24 + Math.max(0, nOpps - 1) * 0.035);
  vector[58] = rangeEquity(f);
  vector[59] = toCall <= 0 || nOpps < 2 ? 0 : Math.min(0.35,
    (posFraction >= 0.6 ? 0.12 : 0) + (f.count === 4 && f.highestRank <= 9 ? 0.18 : 0) +
    (f.count === 3 && f.highestRank <= 7 ? 0.1 : 0) + (pot >= 12 ? 0.05 : 0));
  vector[60] = phase === "BET" && nOpps >= 1 && nOpps <= 2 && toCall === 0 &&
    state.currentBet === 0 && posFraction >= 0.8 && f.count === 3 &&
    f.highestRank <= 7 && drawsRemaining >= 2 && pot <= 14 ? 1 : 0;
  const betHistory = hero.betHistory ?? [false, false, false];
  const drawHistory = hero.drawHistory ?? [0, 0, 0];
  for (let index = 0; index < 3; index += 1) vector[61 + index] = betHistory[index] ? 1 : 0;
  vector[64] = hero.openedCurrentRound ? 1 : 0;
  vector[65] = drawHistory[0] / 3;
  vector[66] = drawHistory[1] / 3;
  vector[67] = hero.lastDrawCount / 3;
  const oppDrawHistory = [0, 1, 2].map((round) => mean(opponents.map((player) => player.drawHistory?.[round] ?? 0)));
  vector[68] = clamp((oppDrawHistory[0] - oppDrawHistory[1]) / 3, -1, 1);
  vector[69] = clamp((oppDrawHistory[1] - oppDrawHistory[2]) / 3, -1, 1);
  vector[70] = clamp((oppLastDraw - hero.lastDrawCount) / 3, -1, 1);
  const discarded = hero.discardedCards ?? [];
  vector[71] = Math.min(1, discarded.filter(([rank]) => rank === 0).length / 4);
  vector[72] = Math.min(1, discarded.filter(([rank]) => rank <= 3).length / 16);
  vector[73] = isButton ? 0 : 1;
  vector[74] = Math.min(1, (oppStack / Math.max(1, hero.stack)) / 2);
  return vector;
}
