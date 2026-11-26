import { describe, expect, it } from 'vitest';
import { screenFiveLowInitialDealDraft } from '../badugiFiveLowInitialScreenDraft.js';

describe('offline five-low initial-deal screen', () => {
  it('uses the real controller to find four-card A-5 Badugis', () => {
    const first = screenFiveLowInitialDealDraft({ seed: 3500000214, isTournament: false });
    expect(first.targets).toEqual([{
      seat: 5, ranks: [1, 2, 4, 5], cards: ['AH', '4C', '5D', '2S'],
    }]);
    expect(first.ledger.accounted).toBe(first.ledger.chipPool);
    const second = screenFiveLowInitialDealDraft({ seed: 3500000431, isTournament: false });
    expect(second.targets).toEqual([{
      seat: 0, ranks: [1, 2, 3, 5], cards: ['5S', '2H', 'AC', '3D'],
    }]);
  });

  it('rejects seed aliases outside controller uint32 range', () => {
    expect(() => screenFiveLowInitialDealDraft({ seed: 2 ** 32, isTournament: false }))
      .toThrow(/uint32/);
  });
});
