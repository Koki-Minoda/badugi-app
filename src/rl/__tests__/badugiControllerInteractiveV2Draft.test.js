import { describe, expect, it } from 'vitest';
import { BadugiControllerInteractiveV2Draft } from '../badugiControllerInteractiveV2Draft.js';
import { selectBadugiControllerDrawIndexesV2Draft } from '../badugiControllerDrawIndexesV2Draft.js';

describe('Badugi v2 interactive controller training boundary', () => {
  it('retains a complete Badugi when asked to pat and never selects duplicate indices', () => {
    const hand = ['AC', '2D', '3H', '4S'];
    expect(selectBadugiControllerDrawIndexesV2Draft(hand, 0)).toEqual([]);
    for (let count = 0; count <= 4; count += 1) {
      const indices = selectBadugiControllerDrawIndexesV2Draft(hand, count);
      expect(indices).toHaveLength(count);
      expect(new Set(indices).size).toBe(count);
    }
  });

  it.each([
    [2, 2, false], [3, 3, false], [6, 6, false], [6, 2, false], [6, 3, false],
    [2, 2, true], [3, 3, true], [6, 6, true], [6, 2, true], [6, 3, true],
  ])('takes masked BET/DRAW actions through three hands at %i seats with %i occupied, MTT=%s',
    (seatCount, occupiedSeatCount, isTournament) => {
      const session = new BadugiControllerInteractiveV2Draft({
        seatCount, occupiedSeatCount, isTournament, seed: 20261104 + seatCount,
      });
      let betCount = 0;
      let drawCount = 0;
      for (let hand = 0; hand < 3; hand += 1) {
        let response = session.nextHand();
        if (hand === 0) {
          expect(session.startingStacks.filter((stack) => stack > 0))
            .toEqual(Array(occupiedSeatCount).fill(isTournament ? 2000 : 500));
          expect(response.activeBigBlind).toBe(isTournament ? 50 : 20);
        }
        while (response.type === 'decision') {
          expect(response.observation).toHaveLength(96);
          expect(response.occupiedSeatCount).toBe(occupiedSeatCount);
          expect(response.observation[10]).toBeCloseTo(seatCount / 6);
          expect(response.observation.slice(32, 38)).toEqual(response.legalMask);
          const preferences = response.phase === 'BET'
            ? [4, 3, 2, 1, 0]
            : [4, 3, 2, 1, 0];
          const actionIndex = preferences.find((index) => response.legalMask[index]);
          expect(actionIndex).toBeDefined();
          if (response.phase === 'BET') betCount += 1;
          else drawCount += 1;
          response = session.step(actionIndex);
        }
        expect(response.type).toBe('hand_end');
        expect(response.chipDeltaBySeat.reduce((a, b) => a + b, 0)).toBe(0);
        expect(response.publicActionTrace).toHaveLength(response.decisionCount);
        expect(response.publicActionTrace.every((action) =>
          action.type === 'BET_ACTION' || action.type === 'DRAW_ACTION')).toBe(true);
        expect(response.publicActionTrace.filter((action) => action.type === 'BET_ACTION')
          .every((action) => Number.isFinite(action.amount) && action.amount >= 0 &&
            action.amount <= action.stackBefore)).toBe(true);
      }
      expect(betCount).toBeGreaterThan(0);
      expect(drawCount).toBeGreaterThan(0);
    });

  it('rejects an unmasked action before changing the controller state', () => {
    const session = new BadugiControllerInteractiveV2Draft({
      seatCount: 2, isTournament: false, seed: 99,
    });
    const before = session.nextHand();
    const blocked = before.legalMask.findIndex((value) => value === 0);
    expect(blocked).toBeGreaterThanOrEqual(0);
    expect(() => session.step(blocked)).toThrow('unmasked');
    expect(session.currentDecision()).toEqual(before);
  });
});
