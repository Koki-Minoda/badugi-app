import { describe, expect, it } from 'vitest';
import { evaluateBadugi } from '../../../games/badugi/utils/badugiEvaluator.js';
import { compareBadugiRangePair, parseBadugiRange } from '../badugiEquity.js';
import { BADUGI_RANGE_PRESETS, generateBadugiRangePresets, orderedRangePresets } from '../badugiRangePresets.js';
import { analyzeRangeSensitivity } from '../badugiRangeSensitivity.js';
import { readBadugiRangeReviews, saveBadugiRangeComparison } from '../../personalResults/badugiRangeReviewStore.js';

const hero = ['AS', '3H', '5D', '10C'];
const deadCards = ['QH', '2C'];
const ranges = ['2S 4H 6D 8C', '2D 4S 8H QC'];
const base = { hands: [hero, []], remainingDraws: 1, deadCards };

describe('Badugi range presets and comparisons', () => {
  it('builds distinct blocker-safe candidates and balances the two rank groups', () => {
    const presets = generateBadugiRangePresets({ hero, deadCards });
    expect(Object.values(presets).every(Boolean)).toBe(true);
    expect(orderedRangePresets(1).slice(0, 2).map(preset => preset.draw)).toEqual([1, 1]);
    for (const { id, groups } of BADUGI_RANGE_PRESETS) {
      const { candidates } = parseBadugiRange(presets[id].text);
      expect(new Set(candidates.map(candidate => candidate.cards.slice().sort().join())).size).toBe(candidates.length);
      expect(candidates.length).toBeLessThanOrEqual(16);
      const weights = {};
      for (const { cards, weight } of candidates) {
        expect(cards.some(card => [...hero, ...deadCards].includes(card))).toBe(false);
        const rank = evaluateBadugi(cards);
        const group = `${rank.count}-${rank.kicker <= 8 ? 'low' : 'high'}`;
        expect(groups).toContain(group);
        weights[group] = (weights[group] ?? 0) + weight;
      }
      if (groups.length === 2) expect(weights[groups[0]]).toBe(weights[groups[1]]);
    }
  });

  it('finds the exact mixing threshold when changing only the opponent range', () => {
    const result = compareBadugiRangePair(base, ranges, 0);
    expect(result.approximate).toBe(false);
    expect(result.endpoints).toMatchObject([{ id: '10C', clear: true }, { id: 'pat', clear: true }]);
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0]).toMatchObject({ from: '10C', to: 'pat' });
    const weight = result.transitions[0].weight;
    const mixed = result.actions.map(({ id, a, b }) => [id, (1 - weight) * a + weight * b]);
    const [pat, ten] = [mixed.find(([id]) => id === 'pat')[1], mixed.find(([id]) => id === '10C')[1]];
    expect(ten).toBeCloseTo(pat, 12);
    expect(mixed.every(([, equity]) => equity <= pat + 1e-10)).toBe(true);
    expect(compareBadugiRangePair(base, [ranges[0], 'AS 4H 6D 8C'], 0)).toMatchObject({ error: 'rangeBlocked', profile: 1 });
  });

  it('uses the strongest action across the mixture, including a third action between endpoint winners', () => {
    const result = analyzeRangeSensitivity([
      { id: 'pat', a: 0.8, b: 0.2 }, { id: '10C', a: 0.2, b: 0.8 }, { id: 'AS', a: 0.6, b: 0.6 },
    ]);
    expect(result.transitions).toHaveLength(2);
    expect(result.transitions[0]).toMatchObject({ from: 'pat', to: 'AS' });
    expect(result.transitions[0].weight).toBeCloseTo(1 / 3);
    expect(result.transitions[1]).toMatchObject({ from: 'AS', to: '10C' });
    expect(result.transitions[1].weight).toBeCloseTo(2 / 3);
    const close = analyzeRangeSensitivity([
      { id: 'pat', a: 0.6, b: 0.59, approximate: true }, { id: '10C', a: 0.59, b: 0.6, approximate: true },
    ]);
    expect(close.endpoints.every(endpoint => !endpoint.clear)).toBe(true);
    expect(close.transitions).toEqual([]);
  });

  it('preserves both editable inputs, evidence and the note per replay decision and account', () => {
    const spot = { handId: 'saved-demo', actionSeq: 5, cards: hero, remainingDraws: 1, observedCount: 0 };
    const assumptions = ranges.map(text => ({ preset: null, text }));
    const comparison = { base, assumptions, count: 0 };
    const result = compareBadugiRangePair(base, ranges, 0);
    expect(saveBadugiRangeComparison(3, spot, { ...comparison, count: 1 }, result, 'alternate')).toBe(false);
    expect(saveBadugiRangeComparison(3, spot, comparison, result, ' 手順まで確認 ')).toBe(true);
    expect(readBadugiRangeReviews(3)).toEqual([expect.objectContaining({ assumptions, result, deadCards, note: '手順まで確認', count: 0 })]);
    expect(readBadugiRangeReviews(4)).toEqual([]);
    expect(saveBadugiRangeComparison(3, spot, comparison, result, '更新')).toBe(true);
    expect(readBadugiRangeReviews(3)).toHaveLength(1);
  });
});
