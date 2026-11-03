import { describe, expect, it } from 'vitest';
import { buildBadugiLiveTrainingObservationDiagnostic } from '../badugiLiveTrainingObservationDiagnostic.js';

function input() {
  const players = Array.from({ length: 6 }, (_, seat) => ({
    stack: 500, betThisRound: 0, totalInvested: 20,
    folded: false, lastDrawCount: seat === 0 ? 1 : null,
  }));
  players[0].hand = ['AC', '2D', '3H', '4S'];
  players[2].hasFolded = true;
  Object.defineProperty(players[1], 'hand', {
    get() { throw new Error('opponent private hand was read'); },
  });
  const opponentDraw = {
    type: 'DRAW_ACTION', seat: 1, drawRoundIndex: 0, betRoundIndex: 0,
    drawCount: 0,
    get replacedCards() { throw new Error('opponent private draw cards were read'); },
    get playersAfter() { throw new Error('opponent private snapshot was read'); },
  };
  return {
    players,
    events: [
      { type: 'BET_ACTION', seat: 1, action: 'raise', amount: 20,
        drawRoundIndex: 0, betRoundIndex: 0 },
      opponentDraw,
      { type: 'DRAW_ACTION', seat: 0, drawRoundIndex: 0, betRoundIndex: 0,
        drawCount: 1, replacedCards: [{ oldCard: 'KC', newCard: 'AC' }] },
    ],
    seatIndex: 0, phase: 'BET', drawRoundIndex: 1, dealerIndex: 5,
    bigBlind: 20, raiseCount: 0, currentBet: 0,
    legalActions: ['CHECK', 'BET'],
  };
}

describe('Badugi live training observation diagnostic', () => {
  it('uses only actor private cards and normalizes public chips to trainer BB units', () => {
    const vector = buildBadugiLiveTrainingObservationDiagnostic(input());
    expect(vector).toHaveLength(96);
    expect(vector.every(Number.isFinite)).toBe(true);
    expect(vector[0]).toBe(0); // Ace rank is zero-based in the trainer.
    expect(vector[9]).toBe(0.25); // 500 live chips at BB=20 -> 50 trainer chips.
    expect(vector[65]).toBeCloseTo(1 / 3);
    expect(vector[67]).toBeCloseTo(1 / 3);
    expect(vector[56]).toBe(0.8); // UI hasFolded must remove that opponent.
    expect(vector[32 + 1]).toBe(1); // CHECK is legal.
  });

  it('rejects absent round tags and incomplete actor discard history', () => {
    const withoutTag = input();
    delete withoutTag.events[0].drawRoundIndex;
    expect(() => buildBadugiLiveTrainingObservationDiagnostic(withoutTag))
      .toThrow(/round tags/);
    const withoutDiscard = input();
    withoutDiscard.events[2].replacedCards = [];
    expect(() => buildBadugiLiveTrainingObservationDiagnostic(withoutDiscard))
      .toThrow(/discarded-card history/);
  });
});
