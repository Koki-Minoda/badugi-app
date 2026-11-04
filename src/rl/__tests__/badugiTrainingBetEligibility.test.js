import { describe, expect, it } from 'vitest';
import { canBadugiTrainingModelIncreaseBet } from '../badugiTrainingBetEligibility.js';
import { getFixedLimitBetSize } from '../../games/badugi/logic/bettingRules.js';

describe('Badugi ONNX fixed-limit eligibility', () => {
  const eligible = (stack, toCall, liveBetSize, trainerBetSize, canRaise = true) =>
    canBadugiTrainingModelIncreaseBet({ stack, toCall, liveBetSize, trainerBetSize, canRaise });

  it('does not offer a trainer-invalid short all-in raise', () => {
    expect(eligible(15, 20, 20, 20)).toBe(false);
    expect(eligible(40, 20, 20, 20)).toBe(true);
  });

  it('requires the larger live increment when street schedules differ', () => {
    expect(getFixedLimitBetSize({ baseBet: 20, drawRound: 1, firstBigBetRound: 1 })).toBe(40);
    expect(eligible(30, 0, 40, 20)).toBe(false);
    expect(eligible(40, 0, 40, 20)).toBe(true);
    expect(eligible(40, 20, 40, 20)).toBe(false);
  });

  it('still respects controller permission and rejects incomplete values', () => {
    expect(eligible(100, 0, 20, 20, false)).toBe(false);
    expect(eligible(Number.NaN, 0, 20, 20)).toBe(false);
  });
});
