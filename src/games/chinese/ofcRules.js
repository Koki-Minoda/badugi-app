import { evaluateChineseRows, compareChineseScore } from './chinesePokerScorer.js';
export const OFC_ROWS = Object.freeze({ front: 3, middle: 5, back: 5 });

// Classic OFC: five cards then eight single-card streets; 13-card Fantasyland.
// Royalties: https://www.pokerstars.com/poker/learn/news/tips-on-how-to-play-and-win-at-chinese-poker/
export function evaluateOfcRows(rows) {
  const evaluation = evaluateChineseRows(rows);
  const royal = ev => ev.metadata.category === 'straight-flush' && ev.metadata.ranks[0] === 14;
  const table = { straight: 2, flush: 4, 'full-house': 6, 'four-of-a-kind': 10, 'straight-flush': 15 };
  const f = evaluation.front.metadata;
  const front = f.category === 'trips' ? f.ranks[0] + 8 : f.category === 'pair' ? Math.max(0, f.ranks[0] - 5) : 0;
  const back = royal(evaluation.back) ? 25 : table[evaluation.back.metadata.category] ?? 0;
  const middle = royal(evaluation.middle) ? 50 : evaluation.middle.metadata.category === 'three-of-a-kind' ? 2 : 2 * (table[evaluation.middle.metadata.category] ?? 0);
  return { ...evaluation, royalties: { front, middle, back, total: evaluation.foul ? 0 : front + middle + back } };
}
export function qualifiesForFantasyland(evaluation, alreadyInFantasyland = false) {
  if (evaluation.foul) return false;
  const { front, middle, back } = evaluation;
  if (alreadyInFantasyland) return front.metadata.category === 'trips' || ['full-house', 'four-of-a-kind', 'straight-flush'].includes(middle.metadata.category) || ['four-of-a-kind', 'straight-flush'].includes(back.metadata.category);
  return front.metadata.category === 'trips' || (front.metadata.category === 'pair' && front.metadata.ranks[0] >= 12);
}
export function scoreOfcPair(left, right) {
  if (left.foul && right.foul) return { rows: {}, scoop: 0, royalties: 0, total: 0 };
  if (left.foul) return { rows: { front: -1, middle: -1, back: -1 }, scoop: -3, royalties: -right.royalties.total, total: -6 - right.royalties.total };
  if (right.foul) return { rows: { front: 1, middle: 1, back: 1 }, scoop: 3, royalties: left.royalties.total, total: 6 + left.royalties.total };
  const rows = Object.fromEntries(Object.keys(OFC_ROWS).map(row => [row, -Math.sign(compareChineseScore(left[row], right[row]))]));
  const points = Object.values(rows).reduce((a, b) => a + b, 0);
  const scoop = Math.abs(points) === 3 ? Math.sign(points) * 3 : 0;
  const royalties = left.royalties.total - right.royalties.total;
  return { rows, scoop, royalties, total: points + scoop + royalties };
}
