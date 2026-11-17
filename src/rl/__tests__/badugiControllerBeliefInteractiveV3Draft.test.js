import { describe, expect, it } from 'vitest';
import { BadugiControllerBeliefInteractiveV3Draft } from '../badugiControllerBeliefInteractiveV3Draft.js';

describe('candidate-only Badugi belief evidence', () => {
  it('uses the real controller but exposes only actor cards and public opponent actions', () => {
    const session = new BadugiControllerBeliefInteractiveV3Draft({
      seatCount: 2, occupiedSeatCount: 2, isTournament: false, seed: 66117,
      includeLedger: true,
    });
    let decision = session.nextHand();
    let observedOpponentDraw = false;
    let decisions = 0;
    while (decision.type === 'decision') {
      const { actorSeenCards, publicActions, showdownCardsIncluded,
        actorHandProgress, opponentPublicHistory } = decision.beliefEvidence;
      expect(actorSeenCards.length).toBeGreaterThanOrEqual(4);
      expect(new Set(actorSeenCards.map((card) => card.join(':'))).size).toBe(actorSeenCards.length);
      expect(showdownCardsIncluded).toBe(false);
      expect(actorHandProgress.current.madeCards).toBeGreaterThanOrEqual(1);
      expect(actorHandProgress.current.madeCards).toBeLessThanOrEqual(4);
      expect(actorHandProgress.madeCardGain).toBe(
        actorHandProgress.current.madeCards - actorHandProgress.initial.madeCards);
      expect(opponentPublicHistory[decision.seat]).toBeNull();
      expect(opponentPublicHistory[1 - decision.seat].handsObserved).toBe(0);
      for (const event of publicActions) {
        expect(Object.keys(event).sort()).toEqual(event.type === 'BET_ACTION'
          ? ['action', 'amountBb', 'drawRoundIndex', 'seat', 'type'].sort()
          : ['drawCount', 'drawRoundIndex', 'seat', 'type'].sort());
        if (event.type === 'DRAW_ACTION' && event.seat !== decision.seat) {
          observedOpponentDraw = true;
        }
      }
      const order = decision.phase === 'DRAW' ? [1, 0, 2, 3, 4] : [2, 1, 4, 3, 0];
      const action = order.find((index) => decision.legalMask[index] === 1);
      decision = session.step(action);
      decisions += 1;
      expect(decisions).toBeLessThan(201);
    }
    expect(decision.type).toBe('hand_end');
    expect(observedOpponentDraw).toBe(true);
    expect(decision.ledger.accounted).toBe(decision.ledger.chipPool);
    const next = session.nextHand();
    expect(next.type).toBe('decision');
    expect(next.beliefEvidence.opponentPublicHistory[1 - next.seat].handsObserved).toBe(1);
    expect(next.beliefEvidence.actorHandProgress.madeCardGain).toBe(0);
    expect(next.beliefEvidence.actorSeenCards).toHaveLength(4);
  });
});
