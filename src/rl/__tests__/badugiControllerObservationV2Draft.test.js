import { describe, expect, it } from 'vitest';
import { GAME_VARIANTS } from '../../games/core/variants.js';
import {
  BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT,
  BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT_SLOTS,
  buildBadugiControllerObservationV2Draft,
} from '../badugiControllerObservationV2Draft.js';
import { buildBadugiInitialControllerObservationV2Draft } from '../badugiInitialControllerObservationV2Draft.js';

function decision(size, overrides = {}) {
  return {
    schemaVersion: BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT,
    players: Array.from({ length: size }, (_, index) => ({
      occupied: true, inHand: true, allIn: false, stack: index === 0 ? 5 : 100,
      betThisRound: index === 1 ? 10 : 0, lastDrawKnown: false,
      lastDrawCount: 0, openedCurrentRound: false,
      priorAggression: false, cumulativeDrawCount: 0,
    })),
    seatIndex: 0, dealerIndex: 1, phase: 'BET', drawRoundIndex: 0,
    bigBlind: 10, currentBet: 10, pot: 20, raiseCount: 0,
    firstToAct: true, isTournament: false,
    controllerLegalActions: ['FOLD', 'CALL', 'RAISE'],
    ownCards: ['4S', 'AS', '3D', '2H'], ownDiscardedCards: [],
    ownBetHistory: [false, false, false], ownDrawHistory: [0, 0, 0],
    ...overrides,
  };
}

describe('Badugi controller observation v2 draft', () => {
  it('has exactly 96 named slots with stable group boundaries', () => {
    expect(BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT_SLOTS).toHaveLength(96);
    expect(new Set(BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT_SLOTS).size).toBe(96);
    expect(BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT_SLOTS[44]).toBe('relative_opponent_1_occupied');
    expect(BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT_SLOTS[94]).toBe('own_discarded_aces_over_4');
  });

  it.each([2, 3, 6])('encodes a %i-seat short-stack decision without hidden data', (size) => {
    const input = decision(size);
    for (const opponent of input.players.slice(1)) {
      for (const key of ['hand', 'profile', 'discardedCards', 'deck']) {
        Object.defineProperty(opponent, key, { get() { throw new Error(`private ${key} read`); } });
      }
    }
    const vector = buildBadugiControllerObservationV2Draft(input);
    expect(vector).toBeInstanceOf(Float32Array);
    expect(vector).toHaveLength(96);
    expect([...vector].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
    [0, 1, 1 / 12, 2 / 3, 2 / 12, 1 / 3, 3 / 12, 1].forEach((expected, index) => {
      expect(vector[index]).toBeCloseTo(expected, 6);
    });
    expect([...vector.slice(32, 38)]).toEqual([1, 0, 1, 0, 0, 0]);
    expect(vector[44]).toBe(1);
    if (size < 6) expect([...vector.slice(44 + (size - 1) * 10, 94)]).toEqual(
      Array((6 - size) * 10).fill(0));
  });

  it('exposes draw four and reserves the sixth output', () => {
    const vector = buildBadugiControllerObservationV2Draft(decision(6, {
      phase: 'DRAW', controllerLegalActions: ['DRAW'],
    }));
    expect([...vector.slice(32, 38)]).toEqual([1, 1, 1, 1, 1, 0]);
  });

  it('fails closed on missing schema and incomplete public history', () => {
    expect(() => buildBadugiControllerObservationV2Draft(decision(2, {
      schemaVersion: 'badugi-observation-v1',
    }))).toThrow(/schema version/);
    expect(() => buildBadugiControllerObservationV2Draft(decision(2, {
      ownDrawHistory: [0, 0],
    }))).toThrow(/history/);
    expect(() => buildBadugiControllerObservationV2Draft(decision(2, {
      ownDrawHistory: [1, 0, 0],
    }))).toThrow(/future.*draw history/);
  });

  it.each([2, 3, 6])('reads the first live controller decision at %i seats', (size) => {
    const seatConfig = ['HERO', ...Array(size - 1).fill('CPU')];
    const controller = GAME_VARIANTS.badugi.controllerFactory({
      seatConfig, startingStack: 500,
      blindStructure: [{ sb: 5, bb: 10, ante: 0 }],
    });
    const initial = controller.createInitialState({ seatConfig });
    const state = controller.createNewHandState(initial, {
      drawCardsForSeat: () => ['AS', '2H', '3D', '4C'],
    });
    const snapshot = controller.getUiSnapshot(state);
    const seatIndex = snapshot.turn ?? snapshot.nextTurn;
    const vector = buildBadugiInitialControllerObservationV2Draft({
      controller, state, seatIndex, isTournament: false,
    });
    expect(vector).toHaveLength(96);
    expect(vector[10]).toBeCloseTo(size / 6);
    expect(vector[21]).toBe(0);
    expect([...vector.slice(32, 38)].some(Boolean)).toBe(true);
  });

  it.each([
    ['cash', 500, false],
    ['MTT', 800, true],
  ])('uses the active blind for a %s initial stack', (_mode, startingStack, isTournament) => {
    const seatConfig = ['HERO', 'CPU'];
    const controller = GAME_VARIANTS.badugi.controllerFactory({
      seatConfig, startingStack,
      blindStructure: [{ sb: 10, bb: 20, ante: 0 }],
    });
    const initial = controller.createInitialState({ seatConfig });
    const state = controller.createNewHandState(initial, {
      drawCardsForSeat: () => ['AS', '2H', '3D', '4C'],
    });
    const snapshot = controller.getUiSnapshot(state);
    const seatIndex = snapshot.turn ?? snapshot.nextTurn;
    const vector = buildBadugiInitialControllerObservationV2Draft({
      controller, state, seatIndex, isTournament,
    });
    expect(vector[14]).toBeCloseTo(snapshot.players[seatIndex].stack / 20 / 200);
    expect(vector[21]).toBe(Number(isTournament));
  });
});
