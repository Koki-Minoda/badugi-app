import { describe, expect, it } from 'vitest';
import { selectBadugiTrainingDiscardIndexesDiagnostic as select } from '../badugiTrainingDrawSelectionDiagnostic.js';

describe('six-max Badugi training draw selection diagnostic', () => {
  it('breaks a made hand by discarding the highest cards, not aces', () => {
    expect(select(['AC', '2D', '3H', '4S'], 0)).toEqual([]);
    expect(select(['AC', '2D', '3H', '4S'], 1)).toEqual([3]);
    expect(select(['AC', '2D', '3H', '4S'], 2)).toEqual([3, 2]);
  });

  it('discards cards outside the best Badugi subset before breaking it', () => {
    expect(select(['AC', 'AD', '3H', '4S'], 2)).toEqual([1, 3]);
    expect(select(['AC', '2C', '3C', '4C'], 3)).toEqual([1, 2, 3]);
  });

  it('rejects malformed hands and out-of-range model actions', () => {
    expect(() => select(['AC', 'AC', '3H', '4S'], 2)).toThrow(/distinct/);
    expect(() => select(['AC', '2D', '3H', '4S'], 4)).toThrow(/0–3/);
  });
});
