const ACE_LOW_RANK_ORDER = {
  A: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
};

const ACE_HIGH_RANK_ORDER = {
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const STUD_ORDER_VARIANTS = new Set([
  "stud",
  "stud8",
  "razz",
  "razz27",
  "razzdugi",
  "razzducey",
]);

const ACE_HIGH_LOWBALL_VARIANTS = new Set([
  "deuce_to_seven_triple_draw",
  "deuce_to_seven_single_draw",
  "deuce_to_seven",
  "badeucey",
  "razzducey",
]);

const ACE_LOW_LOWBALL_VARIANTS = new Set([
  "ace_to_five_triple_draw",
  "ace_to_five_single_draw",
  "ace_to_five",
  "badacey",
  "razz",
  "razzdugi",
]);

const BADUGI_ORDER_VARIANTS = new Set(["badugi", "badugi_triple_draw"]);

function normalizeDisplayVariant(displayVariant) {
  return String(displayVariant ?? "badugi").trim().toLowerCase();
}

function parseCardRank(card, aceHigh = false) {
  const match = String(card ?? "").trim().toUpperCase().match(/^(10|[2-9TJQKA])/);
  if (!match) return Number.POSITIVE_INFINITY;
  const rank = match[1] === "10" ? "T" : match[1];
  const rankOrder = aceHigh ? ACE_HIGH_RANK_ORDER : ACE_LOW_RANK_ORDER;
  return rankOrder[rank] ?? Number.POSITIVE_INFINITY;
}

export function getDisplayCards(handCards = [], { displayVariant = "badugi" } = {}) {
  const variant = normalizeDisplayVariant(displayVariant);
  const preserveOrder = STUD_ORDER_VARIANTS.has(variant);
  const aceHigh =
    ACE_HIGH_LOWBALL_VARIANTS.has(variant) ||
    (!ACE_LOW_LOWBALL_VARIANTS.has(variant) && !BADUGI_ORDER_VARIANTS.has(variant));
  const lowballHighToLow = ACE_HIGH_LOWBALL_VARIANTS.has(variant);
  const highGame = aceHigh && !lowballHighToLow;
  const rankCounts = new Map();
  handCards.forEach((card) => {
    const rank = parseCardRank(card, aceHigh);
    rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + 1);
  });
  const mappedCards = handCards.map((card, sourceIndex) => {
    const rank = parseCardRank(card, aceHigh);
    return {
      card,
      sourceIndex,
      rank,
      rankCount: rankCounts.get(rank) ?? 1,
    };
  });
  if (preserveOrder) return mappedCards;
  return mappedCards.sort((left, right) => {
    if (right.rankCount !== left.rankCount) return right.rankCount - left.rankCount;
    if (left.rank !== right.rank) {
      if (lowballHighToLow || highGame) return right.rank - left.rank;
      return left.rank - right.rank;
    }
    return left.sourceIndex - right.sourceIndex;
  });
}
