import { describe, expect, it } from 'vitest';
import { screenFourCardRangeInitialDealDraft } from '../badugiFourCardRangeScreenDraft.js';

describe('offline four-card range screen', () => {
  it('recognizes A-5 as a distinct completed four-card class', () => {
    const row = screenFourCardRangeInitialDealDraft({ seed: 3500000214,
      isTournament: false });
    expect(row.targets).toContainEqual({ seat: 5, class: 'A5',
      ranks: [1, 2, 4, 5], cards: ['AH', '4C', '5D', '2S'] });
    const sixToNine = screenFourCardRangeInitialDealDraft({ seed: 3600000003,
      isTournament: false });
    expect(sixToNine.targets).toContainEqual({ seat: 2, class: 'SIX_NINE',
      ranks: [3, 4, 6, 9], cards: ['4S', '6D', '3H', '9C'] });
    expect(row.ledger.accounted).toBe(row.ledger.chipPool);
  });

  it('rejects uint32 aliases', () => {
    expect(() => screenFourCardRangeInitialDealDraft({ seed: 2 ** 32,
      isTournament: false })).toThrow(/uint32/);
  });
});
