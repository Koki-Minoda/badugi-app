import { describe, expect, it } from 'vitest';
import { GAME_VARIANTS } from '../../games/core/variants.js';
import { buildBadugiControllerEventObservationV2Draft } from '../badugiControllerEventProjectionV2Draft.js';
import { buildBadugiInitialControllerObservationV2Draft } from '../badugiInitialControllerObservationV2Draft.js';
import { deriveBadugiControllerPublicChipStateV2Draft } from '../badugiControllerPublicChipStateV2Draft.js';

function laterDecision() {
  const players = [
    { stack: 470, betThisRound: 0, totalInvested: 30,
      hand: ['5S', '2H', '3D', '4C'], lastDrawCount: 1 },
    { stack: 470, betThisRound: 0, totalInvested: 30, lastDrawCount: 0 },
  ];
  Object.defineProperty(players[1], 'hand', {
    get() { throw new Error('opponent private hand was read'); },
  });
  const opponentPat = {
    type: 'DRAW_ACTION', seat: 1, drawRoundIndex: 0, betRoundIndex: 0,
    drawCount: 0,
    get replacedCards() { throw new Error('opponent private discards were read'); },
  };
  const events = [
    { type: 'BET_ACTION', seat: 1, drawRoundIndex: 0, betRoundIndex: 0, action: 'raise' },
    { type: 'BET_ACTION', seat: 0, drawRoundIndex: 0, betRoundIndex: 0, action: 'call' },
    opponentPat,
    { type: 'DRAW_ACTION', seat: 0, drawRoundIndex: 0, betRoundIndex: 0,
      drawCount: 1, replacedCards: [{ oldCard: 'AS', newCard: '5S' }] },
  ];
  const snapshot = {
    players, phase: 'BET', drawRound: 1, dealerIdx: 1,
    blindLevelIndex: 0, raiseCountThisRound: 0,
  };
  const controller = {
    config: { blindStructure: [{ bb: 10 }] },
    getUiSnapshot: () => snapshot,
    getLegalActions: () => [{ type: 'FOLD' }, { type: 'CHECK' }, { type: 'RAISE' }],
  };
  return { controller, state: {}, seatIndex: 0, publicEvents: events,
    isTournament: false, snapshot };
}

describe('Badugi controller event projection v2 draft', () => {
  it.each([
    [2, false], [3, false], [6, false],
    [2, true], [3, true], [6, true],
  ])('matches all 96 first-decision slots for %i seats, tournament=%s',
    (seatCount, isTournament) => {
    const seatConfig = ['HERO', ...Array(seatCount - 1).fill('CPU')];
    const blindStructure = isTournament
      ? [{ sb: 5, bb: 10, ante: 0, hands: 1 },
        { sb: 20, bb: 40, ante: 0, hands: 10 }]
      : [{ sb: 5, bb: 10, ante: 0, hands: 999 }];
    const controller = GAME_VARIANTS.badugi.controllerFactory({
      seatConfig, startingStack: isTournament ? 800 : 500,
      blindStructure, lastStructureIndex: blindStructure.length - 1,
    });
    const initial = controller.createInitialState({ seatConfig });
    const state = controller.createNewHandState(initial, {
      ...(isTournament ? { blindState: { blindLevelIndex: 1, handsInLevel: 1 } } : {}),
      drawCardsForSeat: (seat) => [
        `${'A23456789TJQK'[seat]}S`, `${'A23456789TJQK'[seat + 1]}H`,
        `${'A23456789TJQK'[seat + 2]}D`, `${'A23456789TJQK'[seat + 3]}C`,
      ],
    });
    const snapshot = controller.getUiSnapshot(state);
    const seatIndex = snapshot.turn ?? snapshot.nextTurn;
    const first = buildBadugiInitialControllerObservationV2Draft({
      controller, state, seatIndex, isTournament,
    });
    const projected = buildBadugiControllerEventObservationV2Draft({
      controller, state, seatIndex, publicEvents: [], isTournament,
    });
    expect([...projected]).toEqual([...first]);
    expect(projected[10]).toBeCloseTo(seatCount / 6);
    expect(projected[21]).toBe(Number(isTournament));
    expect(projected[14]).toBeCloseTo(
      snapshot.players[seatIndex].stack / blindStructure[isTournament ? 1 : 0].bb / 200);
  });

  it.each([
    [2, false], [3, false], [6, false],
    [2, true], [3, true], [6, true],
  ])('projects a post-draw BET decision for %i seats, tournament=%s',
    (seatCount, isTournament) => {
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
    const publicEvents = [];
    for (let step = 0; step < seatCount * 4 + 4; step += 1) {
      const snapshot = controller.getUiSnapshot(state);
      if (snapshot.phase === 'BET' && snapshot.drawRound === 1) break;
      const seatIndex = snapshot.turn ?? snapshot.nextTurn;
      const legal = controller.getLegalActions(state, seatIndex).map((entry) => entry.type);
      const type = snapshot.phase === 'DRAW' ? 'DRAW'
        : legal.includes('CHECK') ? 'CHECK' : 'CALL';
      const payload = type === 'DRAW'
        ? { type: 'draw', drawIndexes: [], handAfter: snapshot.players[seatIndex].hand }
        : { type: type.toLowerCase() };
      const result = controller.applyAction(state, { seatIndex, payload });
      expect(result.events.some((event) => event.type === 'invalidAction')).toBe(false);
      publicEvents.push({
        type: type === 'DRAW' ? 'DRAW_ACTION' : 'BET_ACTION',
        seat: seatIndex, action: type.toLowerCase(), drawRoundIndex: snapshot.drawRound,
        betRoundIndex: snapshot.drawRound,
        ...(type === 'DRAW' ? { drawCount: 0, replacedCards: [] } : {}),
      });
      state = result.state;
    }
    const snapshot = controller.getUiSnapshot(state);
    expect(snapshot.phase).toBe('BET');
    expect(snapshot.drawRound).toBe(1);
    const seatIndex = snapshot.turn ?? snapshot.nextTurn;
    const vector = buildBadugiControllerEventObservationV2Draft({
      controller, state, seatIndex, publicEvents, isTournament,
    });
    expect(vector).toHaveLength(96);
    expect(vector[9]).toBeCloseTo(1 / 3);
    expect(vector[41]).toBe(0);
    expect(vector[21]).toBe(Number(isTournament));
    expect(vector[10]).toBeCloseTo(seatCount / 6);
    expect(snapshot.blindLevelIndex).toBe(isTournament ? 1 : 0);
    expect(vector[19]).toBeCloseTo(0.5);
    for (let offset = 1; offset < seatCount; offset += 1) {
      expect(vector[44 + (offset - 1) * 10 + 5]).toBe(1);
      expect(vector[44 + (offset - 1) * 10 + 6]).toBe(0);
    }
  });

  it('projects later public BET/DRAW history without reading opponent cards', () => {
    const input = laterDecision();
    const vector = buildBadugiControllerEventObservationV2Draft(input);
    expect(vector).toHaveLength(96);
    expect(vector[9]).toBeCloseTo(1 / 3); // round one
    expect(vector[41]).toBeCloseTo(1 / 4); // actor drew one in round zero
    expect(vector[49]).toBe(1); // opponent's pat was publicly observed
    expect(vector[50]).toBe(0); // opponent drew zero
    expect(vector[52]).toBe(1); // opponent raised before this round
    expect(vector[94]).toBeCloseTo(1 / 4); // actor discarded an ace
  });

  it('rejects missing, duplicate and future draw events, including duplicate pat', () => {
    const base = laterDecision();
    const invoke = (publicEvents) => buildBadugiControllerEventObservationV2Draft({
      ...base, publicEvents,
    });
    expect(() => invoke(base.publicEvents.slice(0, 3))).toThrow(/complete public draw events/);
    expect(() => invoke(base.publicEvents.filter((event) =>
      event !== base.publicEvents[2]))).toThrow(/complete public draw events/);
    expect(() => invoke([...base.publicEvents, base.publicEvents[2]])).toThrow(/one valid public draw/);
    expect(() => invoke([...base.publicEvents, {
      type: 'DRAW_ACTION', seat: 1, drawRoundIndex: 1, betRoundIndex: 1,
      drawCount: 0,
    }])).toThrow(/one valid public draw/);
    expect(() => invoke([...base.publicEvents, {
      type: 'BET_ACTION', seat: 1, drawRoundIndex: 2, betRoundIndex: 2,
      action: 'raise',
    }])).toThrow(/round tags/);
    expect(() => invoke([...base.publicEvents, {
      type: 'BET_ACTION', seat: 1, drawRoundIndex: 1, betRoundIndex: 1,
      action: 'all-in',
    }])).toThrow(/unambiguous public bet action/);
  });

  it('rejects public draw history that disagrees with the controller', () => {
    const input = laterDecision();
    input.snapshot.players[0].lastDrawCount = 0;
    expect(() => buildBadugiControllerEventObservationV2Draft(input))
      .toThrow(/disagree with controller state/);
  });

  it('uses the active MTT blind level when the constructor amount is stale', () => {
    const input = laterDecision();
    input.controller.config.blindStructure.push({ bb: 40 });
    input.snapshot.blindLevelIndex = 1;
    input.controller.config.betSize = 10;
    const publicChips = deriveBadugiControllerPublicChipStateV2Draft(
      input.controller, input.snapshot);
    expect(publicChips.bigBlind).toBe(40);
    const vector = buildBadugiControllerEventObservationV2Draft(input);
    expect(vector[14]).toBeCloseTo(470 / 40 / 200);
    expect(vector[15]).toBeCloseTo(60 / 40 / 400);
  });

  it('reads an advanced blind from the real controller hand state', () => {
    const seatConfig = ['HERO', 'CPU'];
    const controller = GAME_VARIANTS.badugi.controllerFactory({
      seatConfig, startingStack: 800,
      blindStructure: [
        { sb: 5, bb: 10, ante: 0, hands: 1 },
        { sb: 20, bb: 40, ante: 0, hands: 10 },
      ],
      lastStructureIndex: 1,
    });
    const initial = controller.createInitialState({ seatConfig });
    const state = controller.createNewHandState(initial, {
      blindState: { blindLevelIndex: 1, handsInLevel: 1 },
      drawCardsForSeat: () => ['AS', '2H', '3D', '4C'],
    });
    const snapshot = controller.getUiSnapshot(state);
    expect(snapshot.blindLevelIndex).toBe(1);
    const seatIndex = snapshot.turn ?? snapshot.nextTurn;
    const vector = buildBadugiInitialControllerObservationV2Draft({
      controller, state, seatIndex, isTournament: true,
    });
    expect(vector[14]).toBeCloseTo(snapshot.players[seatIndex].stack / 40 / 200);
    expect(vector[21]).toBe(1);
  });
});
