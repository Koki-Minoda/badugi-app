import { describe, expect, it } from 'vitest';
import { BadugiControllerBeliefInteractiveV3Draft } from '../badugiControllerBeliefInteractiveV3Draft.js';

describe('candidate-only Badugi belief evidence', () => {
  it('carries the observed blind across a completed hand with raises', () => {
    const session = new BadugiControllerBeliefInteractiveV3Draft({
      seatCount: 2, occupiedSeatCount: 2, isTournament: false, seed: 2150500001,
      includeLedger: true,
    });
    let state = session.nextHand();
    let raises = 0;
    let decisions = 0;
    while (state.type === 'decision') {
      const order = state.phase === 'DRAW' ? [1, 0, 2, 3, 4] : [4, 3, 2, 1, 0];
      const action = order.find((index) => state.legalMask[index] === 1);
      if (state.phase === 'BET' && action === 4) raises += 1;
      state = session.step(action);
      decisions += 1;
      expect(decisions).toBeLessThan(201);
    }
    expect(raises).toBeGreaterThan(0);
    expect(state.ledger.accounted).toBe(state.ledger.chipPool);
    const next = session.nextHand();
    expect(next.type).toBe('decision');
    const opponent = next.beliefEvidence.opponentPublicHistory[1 - next.seat];
    expect(opponent.raiseAmountBbSum).toBeGreaterThan(0);
  });

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
    const history = next.beliefEvidence.opponentPublicHistory[1 - next.seat];
    expect(history.facedBetOpportunities).toBe(
      history.foldedFacingBet + history.calledFacingBet + history.raisedFacingBet);
    expect(history.freeBetOpportunities).toBeGreaterThanOrEqual(history.betWhenFree);
    expect(next.beliefEvidence.actorHandProgress.madeCardGain).toBe(0);
    expect(next.beliefEvidence.actorSeenCards).toHaveLength(4);
  });

  it.each([
    [2, 2, false], [3, 3, false], [6, 6, false], [6, 2, false], [6, 3, false],
    [2, 2, true], [3, 3, true], [6, 6, true], [6, 2, true], [6, 3, true],
  ])('keeps prior-hand public opportunities for %i/%i tournament=%s',
    (seatCount, occupiedSeatCount, isTournament) => {
      const session = new BadugiControllerBeliefInteractiveV3Draft({
        seatCount, occupiedSeatCount, isTournament, seed: 78001 + seatCount * 100 + occupiedSeatCount,
        includeLedger: true,
      });
      for (let hand = 0; hand < 2; hand += 1) {
        let state = session.nextHand();
        let decisions = 0;
        while (state.type === 'decision') {
          const evidence = state.beliefEvidence;
          expect(evidence.actorSeenCards.length).toBeGreaterThanOrEqual(4);
          expect(evidence.opponentPublicHistory[state.seat]).toBeNull();
          if (hand === 0) {
            for (const history of evidence.opponentPublicHistory) {
              if (history) expect(history.handsObserved).toBe(0);
            }
          }
          const order = state.phase === 'DRAW' ? [1, 0, 2, 3, 4] : [2, 1, 4, 3, 0];
          state = session.step(order.find((index) => state.legalMask[index] === 1));
          decisions += 1;
          expect(decisions).toBeLessThan(201);
        }
        expect(state.ledger.accounted).toBe(state.ledger.chipPool);
      }
      const history = session.publicHistory.filter((row) => row.handsObserved > 0);
      expect(history).toHaveLength(occupiedSeatCount);
      for (const row of history) {
        expect(row.handsObserved).toBe(1);
        expect(row.facedBetOpportunities).toBe(
          row.foldedFacingBet + row.calledFacingBet + row.raisedFacingBet);
      }
    });
});
