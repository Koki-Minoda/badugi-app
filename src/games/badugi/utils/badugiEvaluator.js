const RANK_SYMBOLS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_TO_VALUE = Object.fromEntries(RANK_SYMBOLS.map((rank, idx) => [rank, idx]));
const VALUE_TO_RANK = Object.fromEntries(RANK_SYMBOLS.map((rank, idx) => [idx, rank]));
const SUIT_ORDER = ["C", "D", "H", "S"];
const SUIT_TO_VALUE = Object.fromEntries(SUIT_ORDER.map((suit, idx) => [suit, idx]));
const CARD_REGEX = /^(10|[2-9]|[AJQK]|T)([CDHS])$/i;

function normalizeRank(rankInput) {
  if (rankInput == null) return null;
  const token = String(rankInput).trim().toUpperCase();
  if (token === "T") return "10";
  if (RANK_TO_VALUE[token] !== undefined) return token;
  const numeric = Number(token);
  if (Number.isFinite(numeric)) {
    const byIndex = VALUE_TO_RANK[numeric - 1];
    if (byIndex) return byIndex;
  }
  return null;
}

function normalizeSuit(suitInput) {
  if (suitInput == null) return null;
  const token = String(suitInput).trim().toUpperCase();
  return SUIT_TO_VALUE[token] !== undefined ? token : null;
}

function normalizeCard(card) {
  if (!card) {
    throw new Error(`Invalid Badugi card: ${card}`);
  }
  if (typeof card === "string") {
    const trimmed = card.trim();
    const match = trimmed.match(CARD_REGEX);
    if (!match) {
      throw new Error(`Unsupported Badugi card notation: ${card}`);
    }
    const rank = normalizeRank(match[1]);
    const suit = normalizeSuit(match[2]);
    return {
      rank,
      suit,
      rankValue: RANK_TO_VALUE[rank],
      suitValue: SUIT_TO_VALUE[suit],
      raw: `${rank}${suit}`,
    };
  }
  const rank =
    normalizeRank(card.rank) ??
    normalizeRank(card.value) ??
    normalizeRank(card.label) ??
    normalizeRank(card.name);
  const suit =
    normalizeSuit(card.suit) ??
    normalizeSuit(card.color) ??
    normalizeSuit(card.shortSuit);
  if (rank == null || suit == null) {
    throw new Error(`Unsupported Badugi card shape: ${JSON.stringify(card)}`);
  }
  return {
    rank,
    suit,
    rankValue: RANK_TO_VALUE[rank],
    suitValue: SUIT_TO_VALUE[suit],
    raw: card.raw ?? `${rank}${suit}`,
  };
}

function sortAscending(a, b) {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  if (a.suitValue !== b.suitValue) return a.suitValue - b.suitValue;
  return a.raw.localeCompare(b.raw);
}

function sortDescending(a, b) {
  if (a.rankValue !== b.rankValue) return b.rankValue - a.rankValue;
  if (a.suitValue !== b.suitValue) return b.suitValue - a.suitValue;
  return b.raw.localeCompare(a.raw);
}

function deriveBadugiSubset(cards) {
  const sorted = cards.slice().sort(sortAscending);
  const suitUsed = new Set();
  const rankUsed = new Set();
  const active = [];
  const dead = [];
  for (const card of sorted) {
    if (suitUsed.has(card.suit) || rankUsed.has(card.rankValue)) {
      dead.push(card);
      continue;
    }
    active.push(card);
    suitUsed.add(card.suit);
    rankUsed.add(card.rankValue);
  }
  return { active, dead };
}

function toRankSymbols(values = []) {
  return values.map((value) => VALUE_TO_RANK[value] ?? value);
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

function ensureEvaluation(input) {
  if (input && typeof input === "object" && Array.isArray(input.activeCards) && typeof input.count === "number") {
    return input;
  }
  return evaluateBadugi(input);
}

function compareEvaluations(aEval, bEval) {
  if (aEval.count !== bEval.count) {
    return aEval.count - bEval.count;
  }
  const ranksA = aEval.rankValuesDesc;
  const ranksB = bEval.rankValuesDesc;
  const len = Math.max(ranksA.length, ranksB.length);
  for (let i = 0; i < len; i += 1) {
    const va = ranksA[i] ?? Number.POSITIVE_INFINITY;
    const vb = ranksB[i] ?? Number.POSITIVE_INFINITY;
    if (va !== vb) {
      return va - vb;
    }
  }
  return 0;
}

function describeEvaluation(name, evaluation) {
  const rankSymbols = toRankSymbols(evaluation.rankValuesDesc).join("-");
  return `${name ?? "Seat"} ${evaluation.count}-card ${rankSymbols}`;
}

export function evaluateBadugi(cards = []) {
  const list = Array.isArray(cards) ? cards : [cards];
  if (!list.length) {
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
      metadata: { size: 0, ranks: [], cards: [], activeCards: [], deadCards: [], key: "0|" },
    };
  }
  const normalized = list.map(normalizeCard);
  const { active, dead } = deriveBadugiSubset(normalized);
  const count = active.length;
  const activeAsc = active.slice().sort(sortAscending);
  const activeDesc = active.slice().sort(sortDescending);
  const ranksAsc = activeAsc.map((card) => card.rankValue);
  const ranksDesc = activeDesc.map((card) => card.rankValue);
  const activeLabels = activeAsc.map((card) => card.raw);
  const deadLabels = dead.map((card) => card.raw);
  const key = `${count}|${activeDesc
    .map((card) => `${card.rankValue.toString().padStart(2, "0")}${card.suitValue}`)
    .join("")}`;
  const rankType = buildRankType(count);
  return {
    rankType,
    ranks: ranksAsc,
    kicker: ranksAsc[ranksAsc.length - 1] ?? 0,
    isBadugi: count === 4,
    activeCards: activeLabels,
    deadCards: deadLabels,
    count,
    rankValuesDesc: ranksDesc,
    key,
    metadata: {
      size: count,
      ranks: ranksAsc,
      cards: activeLabels,
      activeCards: activeLabels,
      deadCards: deadLabels,
      key,
    },
  };
}

export function compareBadugi(handA, handB) {
  const evalA = ensureEvaluation(handA);
  const evalB = ensureEvaluation(handB);
  const result = compareEvaluations(evalA, evalB);
  console.log("[BADUGI][COMPARE]", {
    a: evalA?.key,
    b: evalB?.key,
    result,
  });
  return result;
}

export function getBestBadugiPlayer(players = []) {
  if (!Array.isArray(players) || players.length === 0) return null;
  let bestEntry = null;
  for (const player of players) {
    if (!player || !player.hand) continue;
    const evaluation = evaluateBadugi(player.hand);
    if (!bestEntry || compareEvaluations(evaluation, bestEntry.evaluation) < 0) {
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
  evaluated.sort((a, b) => compareEvaluations(a.evaluation, b.evaluation));
  const bestEval = evaluated[0].evaluation;
  const winners = evaluated.filter((entry) => compareEvaluations(entry.evaluation, bestEval) === 0);
  console.log(
    "[SHOWDOWN] Evaluated order:",
    evaluated.map((entry) => describeEvaluation(entry.name, entry.evaluation))
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
