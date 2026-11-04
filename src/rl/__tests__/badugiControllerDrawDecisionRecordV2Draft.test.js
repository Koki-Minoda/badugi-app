import { describe, expect, it } from 'vitest';
import { GAME_VARIANTS } from '../../games/core/variants.js';
import { applyBadugiControllerDrawDecisionV2Draft } from '../badugiControllerDrawDecisionRecordV2Draft.js';
import { buildBadugiControllerEventObservationV2Draft } from '../badugiControllerEventProjectionV2Draft.js';
import { buildBadugiControllerSeatEventViewV2Draft } from '../badugiControllerSeatEventViewV2Draft.js';

function reachFirstDraw(seatCount, isTournament = false) {
  const seatConfig = ['HERO', ...Array(seatCount - 1).fill('CPU')];
  const blindStructure = isTournament
    ? [{ sb: 5, bb: 10, ante: 0, hands: 1 },
      { sb: 20, bb: 40, ante: 0, hands: 10 }]
    : [{ sb: 5, bb: 10, ante: 0, hands: 999 }];
  const controller = GAME_VARIANTS.badugi.controllerFactory({
    seatConfig, startingStack: isTournament ? 800 : 500,
    blindStructure, lastStructureIndex: blindStructure.length - 1,
  });
  let state = controller.createNewHandState(
    controller.createInitialState({ seatConfig }), {
      ...(isTournament ? { blindState: { blindLevelIndex: 1, handsInLevel: 1 } } : {}),
      drawCardsForSeat: (seat) => [
        `${'A23456789TJQK'[seat]}S`, `${'A23456789TJQK'[seat + 1]}H`,
        `${'A23456789TJQK'[seat + 2]}D`, `${'A23456789TJQK'[seat + 3]}C`,
      ],
    });
  const observationEvents = [];
  for (let step = 0; step < seatCount * 3; step += 1) {
    const snapshot = controller.getUiSnapshot(state);
    if (snapshot.phase === 'DRAW') break;
    const seatIndex = snapshot.turn ?? snapshot.nextTurn;
    const legal = controller.getLegalActions(state, seatIndex).map((action) => action.type);
    const action = legal.includes('CHECK') ? 'check' : 'call';
    const result = controller.applyAction(state, { seatIndex, payload: { type: action } });
    expect(result.events.some((event) => event.type === 'invalidAction')).toBe(false);
    observationEvents.push({ type: 'BET_ACTION', seat: seatIndex,
      drawRoundIndex: 0, betRoundIndex: 0, action });
    state = result.state;
  }
  expect(controller.getUiSnapshot(state).phase).toBe('DRAW');
  return { controller, state, observationEvents };
}

describe('Badugi controller DRAW decision record v2 draft', () => {
  it.each([
    [2, false], [3, false], [6, false],
    [2, true], [3, true], [6, true],
  ])('records PAT with public/private separation at %i seats, tournament=%s',
    (seatCount, isTournament) => {
      const { controller, state, observationEvents } = reachFirstDraw(seatCount, isTournament);
      const snapshot = controller.getUiSnapshot(state);
      const seatIndex = snapshot.turn ?? snapshot.nextTurn;
      const record = applyBadugiControllerDrawDecisionV2Draft({
        controller, state, seatIndex, observationEvents,
        isTournament, actionIndex: 0,
        drawIndexes: [], replacedCards: [],
        handAfter: snapshot.players[seatIndex].hand,
      });
      expect(record.observation).toHaveLength(96);
      expect(record.legalMask.slice(0, 5)).toEqual([1, 1, 1, 1, 1]);
      expect(record.publicEvent).toMatchObject({
        type: 'DRAW_ACTION', seat: seatIndex, drawCount: 0,
      });
      expect(record.actorProjectionEvent.replacedCards).toEqual([]);
      expect(JSON.stringify(record.publicEvent)).not.toMatch(/"hand"|"replacedCards"/);
    });

  it('records a four-card replacement and rejects a mismatched hand', () => {
    const { controller, state, observationEvents } = reachFirstDraw(2);
    const snapshot = controller.getUiSnapshot(state);
    const seatIndex = snapshot.turn ?? snapshot.nextTurn;
    const beforeHand = snapshot.players[seatIndex].hand;
    const handAfter = ['5S', '6H', '7D', '8C'];
    const drawIndexes = [0, 1, 2, 3];
    const replacedCards = drawIndexes.map((index) => ({
      index, oldCard: beforeHand[index], newCard: handAfter[index],
    }));
    const input = { controller, state, seatIndex, observationEvents,
      isTournament: false, actionIndex: 4, drawIndexes, replacedCards, handAfter };
    expect(() => applyBadugiControllerDrawDecisionV2Draft({
      ...input, handAfter: [...beforeHand],
    })).toThrow(/handAfter differs/);
    const record = applyBadugiControllerDrawDecisionV2Draft(input);
    expect(record.publicEvent.drawCount).toBe(4);
    expect(record.actorProjectionEvent.replacedCards).toHaveLength(4);
    expect(controller.getUiSnapshot(record.state).players[seatIndex].hand).toEqual(handAfter);
  });

  it('builds the next betting input with only the acting seat’s private draws', () => {
    const { controller, state, observationEvents } = reachFirstDraw(2);
    const firstSnapshot = controller.getUiSnapshot(state);
    const firstSeat = firstSnapshot.turn ?? firstSnapshot.nextTurn;
    const firstHand = firstSnapshot.players[firstSeat].hand;
    const firstHandAfter = [...firstHand];
    firstHandAfter[0] = 'KS';
    const first = applyBadugiControllerDrawDecisionV2Draft({
      controller, state, seatIndex: firstSeat, observationEvents,
      isTournament: false, actionIndex: 1,
      drawIndexes: [0], replacedCards: [{
        index: 0, oldCard: firstHand[0], newCard: 'KS',
      }],
      handAfter: firstHandAfter,
    });
    const secondSnapshot = controller.getUiSnapshot(first.state);
    const secondSeat = secondSnapshot.turn ?? secondSnapshot.nextTurn;
    const second = applyBadugiControllerDrawDecisionV2Draft({
      controller, state: first.state, seatIndex: secondSeat,
      observationEvents: [...observationEvents, first.publicEvent],
      isTournament: false, actionIndex: 0,
      drawIndexes: [], replacedCards: [],
      handAfter: secondSnapshot.players[secondSeat].hand,
    });
    expect(second.observation[49]).toBe(1); // Previous opponent draw is public now.
    expect(second.observation[50]).toBeCloseTo(1 / 4);
    const next = controller.getUiSnapshot(second.state);
    expect(next.phase).toBe('BET');
    expect(next.drawRound).toBe(1);
    const actingSeat = next.turn ?? next.nextTurn;
    const allPublic = [...observationEvents, first.publicEvent, second.publicEvent];
    const ownPrivate = actingSeat === firstSeat
      ? [first.actorProjectionEvent] : [second.actorProjectionEvent];
    const view = buildBadugiControllerSeatEventViewV2Draft({
      publicEvents: allPublic, actorDrawEvents: ownPrivate, seatIndex: actingSeat,
    });
    expect(view.filter((event) => event.type === 'DRAW_ACTION' &&
      event.seat !== actingSeat).every((event) => !('replacedCards' in event))).toBe(true);
    expect(() => buildBadugiControllerSeatEventViewV2Draft({
      publicEvents: allPublic, actorDrawEvents: [], seatIndex: actingSeat,
    })).toThrow(/matching private draw cards/);
    const vector = buildBadugiControllerEventObservationV2Draft({
      controller, state: second.state, seatIndex: actingSeat,
      publicEvents: view, isTournament: false,
    });
    expect(vector).toHaveLength(96);
    expect(vector[9]).toBeCloseTo(1 / 3);
  });
});
