import { describe, expect, it } from 'vitest';
import { GAME_VARIANTS } from '../../games/core/variants.js';
import {
  buildBadugiLiveTrainingObservationDiagnostic,
  deriveBadugiTrainingLegalActions,
  deriveBadugiTrainingRaiseCountFromEvents,
} from '../badugiLiveTrainingObservationDiagnostic.js';

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
    bigBlind: 20, currentBet: 0,
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

  it('treats the first post-draw live raise as the trainer opening bet', () => {
    const events = [
      { type: 'BET_ACTION', seat: 0, action: 'raise', drawRoundIndex: 0, betRoundIndex: 0 },
      { type: 'BET_ACTION', seat: 1, action: 'check', drawRoundIndex: 1, betRoundIndex: 1 },
      { type: 'BET_ACTION', seat: 2, action: 'raise', drawRoundIndex: 1, betRoundIndex: 1 },
      { type: 'BET_ACTION', seat: 3, action: 'raise', drawRoundIndex: 1, betRoundIndex: 1 },
    ];
    expect(deriveBadugiTrainingRaiseCountFromEvents(events.slice(0, 1), 0)).toBe(1);
    expect(deriveBadugiTrainingRaiseCountFromEvents(events, 1)).toBe(1);
    expect(deriveBadugiTrainingRaiseCountFromEvents(events.slice(0, 3), 1)).toBe(0);
  });

  it('uses trainer stack and fixed-limit rules for the observation mask', () => {
    expect(deriveBadugiTrainingLegalActions({
      phase: 'BET', drawRoundIndex: 3, stack: 3, toCall: 2, raiseCount: 0,
    })).toEqual(['FOLD', 'CALL']);
    expect(deriveBadugiTrainingLegalActions({
      phase: 'BET', drawRoundIndex: 1, stack: 1, toCall: 0, raiseCount: 0,
    })).toEqual(['CHECK']);
    expect(deriveBadugiTrainingLegalActions({ phase: 'DRAW' }))
      .toEqual(['draw_0', 'draw_1', 'draw_2', 'draw_3']);
  });

  it('keeps the trainer mask distinct from the live short-stack raise rule', () => {
    const controller = GAME_VARIANTS.badugi.controllerFactory({
      seatConfig: ['HERO', 'CPU', 'CPU', 'CPU', 'CPU', 'CPU'],
      startingStack: 500, blindStructure: [{ sb: 10, bb: 20, ante: 0 }],
    });
    const initial = controller.createInitialState({
      seatConfig: ['HERO', 'CPU', 'CPU', 'CPU', 'CPU', 'CPU'],
    });
    const state = controller.createNewHandState(initial, {});
    const snapshot = controller.getUiSnapshot(state);
    const seeded = controller.syncFromExternalState({
      snapshot: {
        ...snapshot, phase: 'BET', turn: 0, nextTurn: 0,
        players: snapshot.players.map((player, seat) => ({
          ...player,
          stack: seat === 0 ? 15 : 500,
          betThisRound: seat === 1 ? 20 : 0,
          folded: false, hasFolded: false, seatOut: false,
        })),
      },
      context: state?.context ?? null, handIndex: state?.handIndex ?? 0,
    });
    const controllerActions = controller.getLegalActions(seeded, 0).map((action) => action.type);
    expect(controllerActions).toContain('RAISE');
    expect(deriveBadugiTrainingLegalActions({
      phase: 'BET', drawRoundIndex: 0, stack: 1.5, toCall: 2, raiseCount: 0,
    })).toEqual(['FOLD', 'CALL']);
  });
});
