// Match the six-max trainer's draw-count to card-selection rule. This fixes
// the card choice for a model's requested count; model strength still needs
// independent live-session evaluation before any promotion.
const RANKS = 'A23456789TJQK';
const SUITS = 'CDHS';

function cardTuple(card) {
  const match = typeof card === 'string'
    ? card.trim().toUpperCase().match(/^([2-9]|10|[AJQK])([CDHS])$/)
    : null;
  if (!match) throw new TypeError('Badugi draw diagnostic requires valid cards');
  return [RANKS.indexOf(match[1] === '10' ? 'T' : match[1]), SUITS.indexOf(match[2])];
}

function betterRanks(candidate, best) {
  if (candidate.length !== best.length) return candidate.length > best.length;
  const descending = [...candidate].sort((a, b) => b - a);
  const bestDescending = [...best].sort((a, b) => b - a);
  for (let index = 0; index < descending.length; index += 1) {
    if (descending[index] !== bestDescending[index]) {
      return descending[index] < bestDescending[index];
    }
  }
  return false;
}

export function selectBadugiTrainingDiscardIndexes(hand, drawCount) {
  if (!Array.isArray(hand) || hand.length !== 4 ||
      !Number.isInteger(drawCount) || drawCount < 0 || drawCount > 3) {
    throw new TypeError('Badugi draw diagnostic requires four cards and 0–3 draws');
  }
  const cards = hand.map(cardTuple);
  if (new Set(cards.map(([rank, suit]) => `${rank}:${suit}`)).size !== 4) {
    throw new TypeError('Badugi draw diagnostic requires distinct cards');
  }
  if (drawCount === 0) return [];
  let bestRanks = [];
  let bestIndexes = [];
  for (let mask = 1; mask < 16; mask += 1) {
    const indexes = [0, 1, 2, 3].filter(index => mask & (1 << index));
    const ranks = indexes.map(index => cards[index][0]);
    const suits = indexes.map(index => cards[index][1]);
    if (new Set(ranks).size !== indexes.length || new Set(suits).size !== indexes.length) continue;
    if (betterRanks(ranks, bestRanks)) {
      bestRanks = ranks;
      bestIndexes = indexes;
    }
  }
  const keep = new Set(bestIndexes);
  const discardedFirst = [0, 1, 2, 3].filter(index => !keep.has(index));
  const worstKept = [...bestIndexes].sort((left, right) =>
    cards[right][0] - cards[left][0] || cards[right][1] - cards[left][1]);
  return [...discardedFirst, ...worstKept].slice(0, drawCount);
}
