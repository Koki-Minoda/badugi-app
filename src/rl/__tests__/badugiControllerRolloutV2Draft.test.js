import { describe, expect, it } from 'vitest';
import { collectBadugiControllerRolloutV2Draft } from '../badugiControllerRolloutV2Draft.js';

describe('Badugi controller rollout v2 draft', () => {
  it.each([
    [2, 2, false], [3, 3, false], [6, 6, false], [6, 2, false], [6, 3, false],
    [2, 2, true], [3, 3, true], [6, 6, true], [6, 2, true], [6, 3, true],
  ])('records two controller hands at %i seats with %i occupied, tournament=%s',
    (seatCount, occupiedSeatCount, isTournament) => {
      const result = collectBadugiControllerRolloutV2Draft({
        seatCount, occupiedSeatCount, isTournament, hands: 2, seed: 20261104,
        includeAuditInputs: true,
      });
      expect(result.hands).toHaveLength(2);
      expect(result.occupiedSeatCount).toBe(occupiedSeatCount);
      expect(result.hands[0].startingStacks.filter((stack) => stack > 0))
        .toEqual(Array(occupiedSeatCount).fill(isTournament ? 2000 : 500));
      expect(result.hands[0].decisions[0].auditInput.blindStructure[
        result.hands[0].decisions[0].auditInput.blindLevelIndex].bb)
        .toBe(isTournament ? 50 : 20);
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
        expect(hand.decisions.every((decision) => {
          const input = decision.auditInput;
          return input.players[decision.seat].hand.length === 4 &&
            input.players.every((player, index) => index === decision.seat || !('hand' in player)) &&
            input.publicEvents.every((event) => !('replacedCards' in event)) &&
            input.actorDrawEvents.every((event) => event.seat === decision.seat);
        })).toBe(true);
      }
    });
});
