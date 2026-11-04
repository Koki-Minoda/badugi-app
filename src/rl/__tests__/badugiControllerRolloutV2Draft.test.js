import { describe, expect, it } from 'vitest';
import { collectBadugiControllerRolloutV2Draft } from '../badugiControllerRolloutV2Draft.js';

describe('Badugi controller rollout v2 draft', () => {
  it.each([
    [2, false], [3, false], [6, false],
    [2, true], [3, true], [6, true],
  ])('records two controller hands at %i seats, tournament=%s',
    (seatCount, isTournament) => {
      const result = collectBadugiControllerRolloutV2Draft({
        seatCount, isTournament, hands: 2, seed: 20261104,
      });
      expect(result.hands).toHaveLength(2);
      for (const hand of result.hands) {
        expect(hand.startingStacks).toHaveLength(seatCount);
        expect(hand.endingStacks).toHaveLength(seatCount);
        expect(hand.decisions.some((decision) => decision.phase === 'BET')).toBe(true);
        expect(hand.decisions.some((decision) => decision.phase === 'DRAW')).toBe(true);
        expect(hand.chipDeltaBySeat.reduce((sum, delta) => sum + delta, 0)).toBe(0);
        expect(hand.decisions.every((decision) =>
          decision.observation.length === 96 &&
          decision.legalMask[decision.actionIndex] === 1)).toBe(true);
        expect(hand.publicEvents.every((event) =>
          !('replacedCards' in event) &&
          !JSON.stringify(event).includes('"hand"'))).toBe(true);
      }
    });
});
