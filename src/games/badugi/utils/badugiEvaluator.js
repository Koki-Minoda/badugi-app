/**
 * @typedef {Object} Card
 * @property {number} rank // 1 (Ace) through 13 (King)
 * @property {string} suit // 'C' | 'D' | 'H' | 'S'
 */

/**
 * @typedef {Object} EvaluatedHand
 * @property {number} count
 * @property {number[]} ranks
 * @property {number[]} key
 */

const RANK_SYMBOLS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_TO_NUMBER = RANK_SYMBOLS.reduce((acc, symbol, idx) => {
  acc[symbol] = idx + 1;
  return acc;
}, {});
const NUMBER_TO_RANK_SYMBOL = RANK_SYMBOLS.reduce((acc, symbol, idx) => {
  acc[idx + 1] = symbol;
  return acc;
}, {});
const SUIT_ORDER = ["C", "D", "H", "S"];
const SUIT_TO_VALUE = SUIT_ORDER.reduce((acc, suit, idx) => {
  acc[suit] = idx;
  return acc;
}, {});
const CARD_REGEX = /^(10|[2-9]|[AJQK]|T)([CDHS])$/i;

const VALID_SUITS = new Set(SUIT_ORDER);

/**
 * Canonical evaluator that works on normalized numeric cards.
 * @param {Card[]} cards
 * @returns {EvaluatedHand}
 */
export function evaluateHand(cards) {
  const normalized = normalizeInput(cards);

  /** @type {{ evaluation: EvaluatedHand } | null} */
  let best = null;

  const subsetCount = 1 << normalized.length;
  for (let mask = 1; mask < subsetCount; mask += 1) {
    const usedSuits = new Set();
    const usedRanks = new Set();
    const ranks = [];
    let validSubset = true;

    for (let idx = 0; idx < normalized.length; idx += 1) {
      if ((mask & (1 << idx)) === 0) continue;
      const card = normalized[idx];
      if (usedSuits.has(card.suit) || usedRanks.has(card.rank)) {
        validSubset = false;
        break;
      }
      usedSuits.add(card.suit);
      usedRanks.add(card.rank);
      ranks.push(card.rank);
    }

    if (!validSubset) continue;

    ranks.sort((a, b) => a - b);
    const evaluation = buildEvaluation(ranks);

    if (!best || isBetter(evaluation, best.evaluation)) {
      best = { evaluation };
      if (evaluation.count === 4) break;
    }
  }

  if (!best) {
    throw new Error("Unable to evaluate Badugi hand.");
  }

  return best.evaluation;
}

/**
 * @param {EvaluatedHand} handA
 * @param {EvaluatedHand} handB
 * @returns {number} +1 if a > b, -1 if a < b, 0 if equal
 */
export function compareHands(handA, handB) {
  const a = assertEvaluation(handA);
  const b = assertEvaluation(handB);

  if (a.count !== b.count) {
    return a.count > b.count ? 1 : -1;
  }

  for (let i = 1; i < a.key.length; i += 1) {
    if (a.key[i] === b.key[i]) continue;
    return a.key[i] < b.key[i] ? 1 : -1;
  }

  return 0;
}

/**
 * Convenience helper that evaluates both hands before comparing them.
 *
 * @param {Card[]} cardsA
 * @param {Card[]} cardsB
 */
export function evaluateAndCompare(cardsA, cardsB) {
  return compareHands(evaluateHand(cardsA), evaluateHand(cardsB));
}

// ----- Legacy compatibility layer (string-based inputs) -----

export function evaluateBadugi(cards = []) {
  const list = normalizeLegacyCards(cards);
  if (!list.length) {
    return emptyLegacyEvaluation();
  }
  const best = selectBestLegacySubset(list);
  if (!best) {
    // Should never happen; default to the first card if the input is malformed.
    return emptyLegacyEvaluation();
  }
  return buildLegacyEvaluation(list, best);
}

export function compareBadugi(handA, handB) {
  const evalA = ensureLegacyEvaluation(handA);
  const evalB = ensureLegacyEvaluation(handB);
  const result = compareBadugiEvaluations(evalA, evalB);
  console.log("[BADUGI][COMPARE]", {
    a: evalA?.key,
    b: evalB?.key,
    result,
  });
  return result;
}

export function compareBadugiEvaluations(left, right) {
  const aEval = ensureLegacyEvaluation(left);
  const bEval = ensureLegacyEvaluation(right);
  if (aEval.count !== bEval.count) {
    return bEval.count - aEval.count;
  }
  const ranksA = Array.isArray(aEval.ranks) ? aEval.ranks : [];
  const ranksB = Array.isArray(bEval.ranks) ? bEval.ranks : [];
  // Example check: 8-high (ranks [1,3,5,7]) beats K-high ([1,3,5,12]).
  const len = Math.max(ranksA.length, ranksB.length);
  for (let i = 0; i < len; i += 1) {
    const diff =
      (ranksA[i] ?? Number.POSITIVE_INFINITY) - (ranksB[i] ?? Number.POSITIVE_INFINITY);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function getBestBadugiPlayer(players = []) {
  if (!Array.isArray(players) || players.length === 0) return null;
  let bestEntry = null;
  for (const player of players) {
    if (!player || !player.hand) continue;
    const evaluation = evaluateBadugi(player.hand);
    if (!bestEntry || compareBadugiEvaluations(evaluation, bestEntry.evaluation) < 0) {
      bestEntry = { player, evaluation };
    }
  }
  return bestEntry ? { ...bestEntry.player, evaluation: bestEntry.evaluation } : null;
}

export function getWinnersByBadugi(players = []) {
  if (!Array.isArray(players) || players.length === 0) return [];
  const evaluated = players
    .filter((player) => player && player.hand && !player.seatOut)
    .map((player) => ({
      seat: player.seat ?? player.seatIndex,
      seatIndex: player.seatIndex ?? player.seat,
      name: player.name ?? `Seat ${player.seat ?? player.seatIndex ?? "?"}`,
      hand: player.hand,
      evaluation: evaluateBadugi(player.hand),
    }));
  if (!evaluated.length) return [];
  evaluated.sort((a, b) => compareBadugiEvaluations(a.evaluation, b.evaluation));
  const bestEval = evaluated[0].evaluation;
  const winners = evaluated.filter(
    (entry) => compareBadugiEvaluations(entry.evaluation, bestEval) === 0,
  );
  console.log(
    "[SHOWDOWN] Evaluated order:",
    evaluated.map((entry) => describeEvaluation(entry.name, entry.evaluation)),
  );
  console.log("[SHOWDOWN] Winners:", winners.map((entry) => entry.name));
  return winners.map((winner) => ({
    seat: winner.seat,
    seatIndex: winner.seatIndex,
    name: winner.name,
    hand: winner.hand,
    evaluation: winner.evaluation,
  }));
}

// ----- helper utilities -----

/**
 * @param {unknown} cards
 * @returns {Required<Card>[]}
 * @throws if the input is not exactly 4 cards or contains invalid data
 */
function normalizeInput(cards) {
  if (!Array.isArray(cards) || cards.length !== 4) {
    throw new Error("Badugi evaluation requires exactly 4 cards.");
  }

  return cards.map((card, idx) => normalizeNumericCard(card, idx));
}

function normalizeNumericCard(card, position) {
  if (!card || typeof card !== "object") {
    throw new Error(`Card at index ${position} is not a valid object.`);
  }

  const rank = Number(card.rank);
  if (!Number.isInteger(rank) || rank < 1 || rank > 13) {
    throw new Error(`Card at index ${position} has invalid rank: ${card.rank}`);
  }

  const suit = normalizeSuit(card.suit, position);

  return { rank, suit };
}

function normalizeLegacyCards(cards) {
  const list = Array.isArray(cards) ? cards : [cards];
  return list
    .filter(Boolean)
    .map((card, idx) => normalizeLegacyCard(card, idx))
    .filter(Boolean);
}

function normalizeLegacyCard(card, position) {
  if (!card) {
    throw new Error(`Invalid Badugi card: ${card}`);
  }
  if (typeof card === "string") {
    const trimmed = card.trim();
    const match = trimmed.match(CARD_REGEX);
    if (!match) {
      throw new Error(`Unsupported Badugi card notation: ${card}`);
    }
    const rankSymbol = normalizeRank(match[1]);
    const suit = normalizeSuit(match[2], position);
    return buildLegacyCard(rankSymbol, suit, trimmed.toUpperCase());
  }
  const rankSymbol =
    normalizeRank(card.rank) ??
    normalizeRank(card.value) ??
    normalizeRank(card.label) ??
    normalizeRank(card.name);
  const suit =
    normalizeSuit(card.suit, position) ??
    normalizeSuit(card.color, position) ??
    normalizeSuit(card.shortSuit, position);
  if (!rankSymbol || !suit) {
    throw new Error(`Unsupported Badugi card shape: ${JSON.stringify(card)}`);
  }
  const raw = typeof card.raw === "string" ? card.raw : `${rankSymbol}${suit}`;
  return buildLegacyCard(rankSymbol, suit, raw.toUpperCase());
}

function normalizeRank(input) {
  if (input == null) return null;
  const token = String(input).trim().toUpperCase();
  if (token === "T") return "10";
  if (RANK_TO_NUMBER[token]) return token;
  if (/^\d+$/.test(token)) {
    const numeric = Number(token);
    if (NUMBER_TO_RANK_SYMBOL[numeric]) {
      return NUMBER_TO_RANK_SYMBOL[numeric];
    }
  }
  return null;
}

function normalizeSuit(input, position) {
  if (!input && input !== 0) {
    throw new Error(`Card at index ${position} has invalid suit: ${input}`);
  }
  const token = String(input).trim().toUpperCase();
  if (!VALID_SUITS.has(token)) {
    throw new Error(`Card at index ${position} has invalid suit: ${input}`);
  }
  return token;
}

function buildLegacyCard(rankSymbol, suit, rawLabel) {
  const rankNumber = RANK_TO_NUMBER[rankSymbol];
  return {
    rank: rankNumber,
    rankSymbol,
    rankValue: rankNumber - 1,
    suit,
    suitValue: SUIT_TO_VALUE[suit],
    raw: rawLabel,
  };
}

function selectBestLegacySubset(cards) {
  const total = cards.length;
  if (total === 0) return null;
  let best = null;
  const subsetCount = 1 << total;
  for (let mask = 1; mask < subsetCount; mask += 1) {
    const usedSuits = new Set();
    const usedRanks = new Set();
    /** @type {{ index: number, card: ReturnType<typeof buildLegacyCard> }[]} */
    const subset = [];
    let valid = true;
    for (let idx = 0; idx < total; idx += 1) {
      if ((mask & (1 << idx)) === 0) continue;
      const card = cards[idx];
      if (usedSuits.has(card.suit) || usedRanks.has(card.rank)) {
        valid = false;
        break;
      }
      usedSuits.add(card.suit);
      usedRanks.add(card.rank);
      subset.push({ index: idx, card });
    }
    if (!valid) continue;
    const ranks = subset.map(({ card }) => card.rank).sort((a, b) => a - b);
    const evaluation = buildEvaluation(ranks);
    if (
      !best ||
      isBetter(evaluation, best.evaluation) ||
      (isEquivalentEvaluation(evaluation, best.evaluation) &&
        prefersSubsetSuits(subset, best.subset))
    ) {
      best = { evaluation, subset };
      if (evaluation.count === 4) break;
    }
  }
  return best;
}

function isEquivalentEvaluation(left, right) {
  if (!left || !right) return false;
  if (left.count !== right.count) return false;
  const leftKey = left.key ?? [];
  const rightKey = right.key ?? [];
  if (leftKey.length !== rightKey.length) return false;
  for (let i = 0; i < leftKey.length; i += 1) {
    if (leftKey[i] !== rightKey[i]) return false;
  }
  return true;
}

function prefersSubsetSuits(candidateSubset, currentSubset) {
  const candidate = [...(candidateSubset ?? [])]
    .map((entry) => entry.card)
    .sort(sortLegacyAscending);
  const current = [...(currentSubset ?? [])]
    .map((entry) => entry.card)
    .sort(sortLegacyAscending);
  const len = Math.max(candidate.length, current.length);
  for (let i = 0; i < len; i += 1) {
    const cand = candidate[i];
    const curr = current[i];
    if (!cand && !curr) break;
    if (!cand) return false;
    if (!curr) return true;
    if (cand.suitValue !== curr.suitValue) {
      return cand.suitValue < curr.suitValue;
    }
    if (cand.rankValue !== curr.rankValue) {
      return cand.rankValue < curr.rankValue;
    }
    const cmp = cand.raw.localeCompare(curr.raw);
    if (cmp !== 0) return cmp < 0;
  }
  return false;
}

function buildLegacyEvaluation(cards, best) {
  const selected = new Set(best.subset.map((entry) => entry.index));
  const activeAsc = [...best.subset.map((entry) => entry.card)].sort(sortLegacyAscending);
  const activeDesc = [...activeAsc].sort(sortLegacyDescending);
  const deadLabels = cards
    .filter((_, idx) => !selected.has(idx))
    .map((card) => card.raw);
  const ranksAsc = activeAsc.map((card) => card.rankValue);
  const ranksDesc = activeDesc.map((card) => card.rankValue);
  const activeLabels = activeAsc.map((card) => card.raw);
  const key = `${best.evaluation.count}|${activeDesc
    .map((card) => `${card.rankValue.toString().padStart(2, "0")}${card.suitValue}`)
    .join("")}`;
  const rankType = buildRankType(best.evaluation.count);
  return {
    rankType,
    ranks: ranksAsc,
    kicker: ranksAsc[ranksAsc.length - 1] ?? 0,
    isBadugi: best.evaluation.count === 4,
    activeCards: activeLabels,
    deadCards: deadLabels,
    count: best.evaluation.count,
    rankValuesDesc: ranksDesc,
    key,
    metadata: {
      size: best.evaluation.count,
      ranks: ranksAsc,
      cards: activeLabels,
      activeCards: activeLabels,
      deadCards: deadLabels,
      key,
    },
  };
}

function emptyLegacyEvaluation() {
  return {
    rankType: "ONE_CARD",
    ranks: [],
    kicker: 0,
    isBadugi: false,
    activeCards: [],
    deadCards: [],
    count: 0,
    rankValuesDesc: [],
    key: "0|",
    metadata: {
      size: 0,
      ranks: [],
      cards: [],
      activeCards: [],
      deadCards: [],
      key: "0|",
    },
  };
}

function sortLegacyAscending(a, b) {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  if (a.suitValue !== b.suitValue) return a.suitValue - b.suitValue;
  return a.raw.localeCompare(b.raw);
}

function sortLegacyDescending(a, b) {
  if (a.rankValue !== b.rankValue) return b.rankValue - a.rankValue;
  if (a.suitValue !== b.suitValue) return b.suitValue - a.suitValue;
  return b.raw.localeCompare(a.raw);
}

function buildRankType(count) {
  switch (count) {
    case 4:
      return "BADUGI";
    case 3:
      return "THREE_CARD";
    case 2:
      return "TWO_CARD";
    case 1:
    default:
      return "ONE_CARD";
  }
}

function ensureLegacyEvaluation(input) {
  if (
    input &&
    typeof input === "object" &&
    Array.isArray(input.activeCards) &&
    typeof input.count === "number"
  ) {
    return input;
  }
  return evaluateBadugi(input);
}

function describeEvaluation(name, evaluation) {
  const rankSymbols = (evaluation.rankValuesDesc ?? []).map(
    (value) => RANK_SYMBOLS[value] ?? `${value}`,
  );
  return `${name ?? "Seat"} ${evaluation.count}-card ${rankSymbols.join("-")}`;
}

/**
 * @param {number[]} ranksAsc
 * @returns {EvaluatedHand}
 */
function buildEvaluation(ranksAsc) {
  const count = ranksAsc.length;
  const key = new Array(5).fill(0);
  key[0] = count;
  for (let i = 0; i < Math.min(ranksAsc.length, 4); i += 1) {
    key[i + 1] = ranksAsc[i];
  }
  return { count, ranks: [...ranksAsc], key };
}

/**
 * @param {EvaluatedHand} candidate
 * @param {EvaluatedHand} current
 */
function isBetter(candidate, current) {
  if (candidate.count !== current.count) {
    return candidate.count > current.count;
  }

  for (let i = 1; i < candidate.key.length; i += 1) {
    if (candidate.key[i] === current.key[i]) continue;
    return candidate.key[i] < current.key[i];
  }

  return false;
}

/**
 * @param {EvaluatedHand} hand
 * @returns {EvaluatedHand}
 */
function assertEvaluation(hand) {
  if (
    !hand ||
    typeof hand !== "object" ||
    typeof hand.count !== "number" ||
    !Array.isArray(hand.ranks) ||
    !Array.isArray(hand.key) ||
    hand.key.length !== 5
  ) {
    throw new Error("compareHands expects valid EvaluatedHand objects.");
  }
  return hand;
}
