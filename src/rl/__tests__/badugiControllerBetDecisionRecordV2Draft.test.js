import { describe, expect, it } from 'vitest';
import { GAME_VARIANTS } from '../../games/core/variants.js';
import { applyBadugiControllerBetDecisionV2Draft } from '../badugiControllerBetDecisionRecordV2Draft.js';
import { buildBadugiControllerEventObservationV2Draft } from '../badugiControllerEventProjectionV2Draft.js';

function hand(seatCount = 2) {
  const seatConfig = ['HERO', ...Array(seatCount - 1).fill('CPU')];
  const controller = GAME_VARIANTS.badugi.controllerFactory({
    seatConfig, startingStack: 500,
    blindStructure: [{ sb: 5, bb: 10, ante: 0, hands: 999 }],
  });
  const state = controller.createNewHandState(
    controller.createInitialState({ seatConfig }), {
      drawCardsForSeat: (seat) => [
        `${'A23456789TJQK'[seat]}S`, `${'A23456789TJQK'[seat + 1]}H`,
        `${'A23456789TJQK'[seat + 2]}D`, `${'A23456789TJQK'[seat + 3]}C`,
      ],
    });
  return { controller, state };
}

describe('Badugi controller BET decision record v2 draft', () => {
  it.each([2, 3, 6])('records a real first decision for %i seats without opponent cards',
    (seatCount) => {
      const { controller, state } = hand(seatCount);
      const snapshot = controller.getUiSnapshot(state);
      const seatIndex = snapshot.turn ?? snapshot.nextTurn;
      const legal = controller.getLegalActions(state, seatIndex).map((action) => action.type);
      const actionIndex = legal.includes('CHECK') ? 1 : 2;
      const record = applyBadugiControllerBetDecisionV2Draft({
        controller, state, seatIndex, publicEvents: [],
        isTournament: false, actionIndex,
      });
      expect(record.observation).toHaveLength(96);
      expect(record.legalMask[actionIndex]).toBe(1);
      expect(record.event).toMatchObject({
        type: 'BET_ACTION', seat: seatIndex,
        action: actionIndex === 1 ? 'check' : 'call',
        drawRoundIndex: 0, betRoundIndex: 0,
      });
      expect(record.event.playersAfter).toHaveLength(seatCount);
      expect(JSON.stringify(record.event)).not.toMatch(/"hand"|"holeCards"/);
      expect(record.event.amount).toBe(
        record.event.betAfter - record.event.betBefore);
      expect(record.controllerEvents.some((event) => event.type === 'invalidAction')).toBe(false);
      const next = controller.getUiSnapshot(record.state);
      if (next.phase === 'BET') {
        const nextSeat = next.turn ?? next.nextTurn;
        const nextObservation = buildBadugiControllerEventObservationV2Draft({
          controller, state: record.state, seatIndex: nextSeat,
          publicEvents: [record.event], isTournament: false,
        });
        expect(nextObservation).toHaveLength(96);
        expect(nextObservation[22]).toBe(0); // The opening action is recorded.
      }
    });

  it('rejects a short raise before applying it and records a full raise', () => {
    const { controller, state } = hand();
    const snapshot = controller.getUiSnapshot(state);
    const makeSeeded = (actorStack) => controller.syncFromExternalState({
      snapshot: {
        ...snapshot, phase: 'BET', turn: 0, nextTurn: 0,
        currentBet: 10, raiseCountThisRound: 0,
        players: snapshot.players.map((player, seat) => ({
          ...player,
          stack: seat === 0 ? actorStack : 490,
          betThisRound: seat === 1 ? 10 : 0,
          totalInvested: seat === 1 ? 10 : 0,
          folded: false, hasFolded: false, seatOut: false,
          isBusted: false, allIn: false,
          hasActedThisRound: seat !== 0,
        })),
      },
      context: state.context, handIndex: state.handIndex,
    });
    expect(() => applyBadugiControllerBetDecisionV2Draft({
      controller, state: makeSeeded(15), seatIndex: 0,
      publicEvents: [], isTournament: false, actionIndex: 4,
    })).toThrow(/outside the model legal mask/);
    const record = applyBadugiControllerBetDecisionV2Draft({
      controller, state: makeSeeded(20), seatIndex: 0,
      publicEvents: [], isTournament: false, actionIndex: 4,
    });
    expect(record.event).toMatchObject({ action: 'raise', amount: 20 });
    expect(controller.getUiSnapshot(record.state).players[0].lastAction).toBe('Raise');
  });

  it('records the first post-draw controller Raise as the model BET action', () => {
    const { controller, state } = hand();
    const snapshot = controller.getUiSnapshot(state);
    const seeded = controller.syncFromExternalState({
      snapshot: {
        ...snapshot, phase: 'BET', drawRound: 1,
        turn: 0, nextTurn: 0, currentBet: 0, raiseCountThisRound: 0,
        players: snapshot.players.map((player) => ({
          ...player, stack: 490, betThisRound: 0, totalInvested: 10,
          lastDrawCount: 0, hasDrawn: false, hasActedThisRound: false,
          folded: false, hasFolded: false,
        })),
      },
      context: state.context, handIndex: state.handIndex,
    });
    const publicEvents = [
      { type: 'BET_ACTION', seat: 0, drawRoundIndex: 0,
        betRoundIndex: 0, action: 'call' },
      { type: 'BET_ACTION', seat: 1, drawRoundIndex: 0,
        betRoundIndex: 0, action: 'check' },
      { type: 'DRAW_ACTION', seat: 0, drawRoundIndex: 0,
        betRoundIndex: 0, drawCount: 0, replacedCards: [] },
      { type: 'DRAW_ACTION', seat: 1, drawRoundIndex: 0,
        betRoundIndex: 0, drawCount: 0, replacedCards: [] },
    ];
    const record = applyBadugiControllerBetDecisionV2Draft({
      controller, state: seeded, seatIndex: 0, publicEvents,
      isTournament: false, actionIndex: 3,
    });
    expect(record.event).toMatchObject({ action: 'bet', amount: 10 });
    expect(record.legalMask[3]).toBe(1);
    expect(controller.getUiSnapshot(record.state).players[0].lastAction).toBe('Raise');
  });
});
