// Fixed, deterministic count-to-card selector for the v2 draft. The network
// chooses 0–4 cards; only the actor's own cards decide which indices to draw.
const RANKS = 'A23456789TJQK';
const SUITS = 'CDHS';

function tuple(card) {
  const match = String(card).toUpperCase().match(/^(10|[2-9TAJQK])([CDHS])$/);
  if (!match) throw new TypeError('v2 draft selector requires valid cards');
  return [RANKS.indexOf(match[1] === '10' ? 'T' : match[1]), SUITS.indexOf(match[2])];
}

function combinations(values, count) {
  if (count === 0) return [[]];
  if (values.length < count) return [];
  return values.flatMap((value, index) =>
    combinations(values.slice(index + 1), count - 1).map((rest) => [value, ...rest]));
}

function score(cards) {
  const candidates = [];
  for (let count = 1; count <= cards.length; count += 1) {
    for (const indices of combinations(cards.map((_, index) => index), count)) {
      const subset = indices.map((index) => cards[index]);
      if (new Set(subset.map(([rank]) => rank)).size !== count ||
          new Set(subset.map(([, suit]) => suit)).size !== count) continue;
      const ranks = subset.map(([rank]) => rank).sort((a, b) => b - a);
      candidates.push([count, ...ranks.map((rank) => -rank)]);
    }
  }
  candidates.sort((a, b) => {
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      const difference = (b[index] ?? 0) - (a[index] ?? 0);
      if (difference) return difference;
    }
    return 0;
  });
  return candidates[0] ?? [0];
}

export function selectBadugiControllerDrawIndexesV2Draft(hand, drawCount) {
  if (!Array.isArray(hand) || hand.length !== 4 ||
      !Number.isInteger(drawCount) || drawCount < 0 || drawCount > 4) {
    throw new TypeError('v2 draft selector requires four cards and 0–4 draws');
  }
  const cards = hand.map(tuple);
  if (new Set(cards.map(([rank, suit]) => `${rank}:${suit}`)).size !== 4) {
    throw new TypeError('v2 draft selector requires distinct cards');
  }
  const candidates = combinations([0, 1, 2, 3], 4 - drawCount);
  candidates.sort((left, right) => {
    const a = score(left.map((index) => cards[index]));
    const b = score(right.map((index) => cards[index]));
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      const difference = (b[index] ?? 0) - (a[index] ?? 0);
      if (difference) return difference;
    }
    return left.join(',').localeCompare(right.join(','));
  });
  const kept = new Set(candidates[0]);
  return [0, 1, 2, 3].filter((index) => !kept.has(index));
}
