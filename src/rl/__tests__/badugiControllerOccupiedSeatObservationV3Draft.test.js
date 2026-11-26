import { describe, expect, it } from 'vitest';
import {
  BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT,
  buildBadugiControllerObservationV2Draft,
} from '../badugiControllerObservationV2Draft.js';
import {
  BADUGI_CONTROLLER_OCCUPIED_SEAT_OBSERVATION_V3_DRAFT,
  BADUGI_CONTROLLER_OCCUPIED_SEAT_OBSERVATION_V3_DRAFT_SLOTS,
  buildBadugiControllerOccupiedSeatObservationV3Draft,
} from '../badugiControllerOccupiedSeatObservationV3Draft.js';

const player = (betThisRound = 0) => ({
  occupied: true, inHand: true, allIn: false, stack: 100,
  betThisRound, lastDrawKnown: false, lastDrawCount: 0,
  openedCurrentRound: false, priorAggression: false,
  cumulativeDrawCount: 0,
});
const empty = () => ({ ...player(), occupied: false, inHand: false, stack: 0 });
const input = (players, seatIndex, dealerIndex, isTournament = false) => ({
  schemaVersion: BADUGI_CONTROLLER_OCCUPIED_SEAT_OBSERVATION_V3_DRAFT,
  players, seatIndex, dealerIndex, phase: 'BET', drawRoundIndex: 0,
  bigBlind: 10, currentBet: 10, pot: 20, raiseCount: 0,
  firstToAct: false, isTournament,
  controllerLegalActions: ['FOLD', 'CALL', 'RAISE'],
  ownCards: ['AS', '2H', '3D', '4C'], ownDiscardedCards: [],
  ownBetHistory: [false, false, false], ownDrawHistory: [0, 0, 0],
});
const v2 = (decision) => buildBadugiControllerObservationV2Draft({
  ...decision, schemaVersion: BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT,
});

describe('Badugi candidate occupied-seat observation v3 draft', () => {
  it('has a distinct schema and named occupied-seat features', () => {
    expect(BADUGI_CONTROLLER_OCCUPIED_SEAT_OBSERVATION_V3_DRAFT_SLOTS).toHaveLength(96);
    expect(BADUGI_CONTROLLER_OCCUPIED_SEAT_OBSERVATION_V3_DRAFT_SLOTS[10])
      .toBe('occupied_seat_count_over_6');
    expect(BADUGI_CONTROLLER_OCCUPIED_SEAT_OBSERVATION_V3_DRAFT_SLOTS[12])
      .toBe('button_relative_occupied_position');
    expect(() => buildBadugiControllerOccupiedSeatObservationV3Draft({
      ...input([player(), player(10)], 0, 1), schemaVersion: BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT,
    })).toThrow(/schema version/);
  });

  it.each([false, true])('matches a two-seat decision on a six-seat table with two occupied seats, MTT=%s', (isTournament) => {
    const heads = input([player(), player(10)], 0, 1, isTournament);
    const shortSix = input([player(), empty(), empty(), player(10), empty(), empty()],
      0, 3, isTournament);
    expect([...buildBadugiControllerOccupiedSeatObservationV3Draft(shortSix)])
      .toEqual([...buildBadugiControllerOccupiedSeatObservationV3Draft(heads)]);
    expect([...buildBadugiControllerOccupiedSeatObservationV3Draft(shortSix).slice(0, 8)])
      .toEqual([...v2(shortSix).slice(0, 8)]);
    expect([...buildBadugiControllerOccupiedSeatObservationV3Draft(shortSix).slice(32, 38)])
      .toEqual([...v2(shortSix).slice(32, 38)]);
  });

  it('keeps occupied-seat position and legal actions after rotating the actor', () => {
    const heads = input([player(10), player()], 1, 0, true);
    const shortSix = input([player(10), empty(), empty(), player(), empty(), empty()],
      3, 0, true);
    expect([...buildBadugiControllerOccupiedSeatObservationV3Draft(shortSix)])
      .toEqual([...buildBadugiControllerOccupiedSeatObservationV3Draft(heads)]);
  });

  it('compresses three occupied seats and keeps folded occupied players', () => {
    const third = { ...player(), inHand: false };
    const compact = input([player(), player(10), third], 0, 1);
    const six = input([player(), empty(), player(10), empty(), third, empty()], 0, 2);
    expect([...buildBadugiControllerOccupiedSeatObservationV3Draft(six)])
      .toEqual([...buildBadugiControllerOccupiedSeatObservationV3Draft(compact)]);
    expect(buildBadugiControllerOccupiedSeatObservationV3Draft(six)[10]).toBeCloseTo(3 / 6);
    expect(buildBadugiControllerOccupiedSeatObservationV3Draft(six)[11]).toBeCloseTo(2 / 6);
  });

  it('preserves the original full six-seat vector and ignores opponent private fields', () => {
    const six = input([player(), player(10), player(), player(), player(), player()], 0, 1);
    for (const opponent of six.players.slice(1)) {
      Object.defineProperty(opponent, 'hand', { get() { throw new Error('private hand read'); } });
    }
    expect([...buildBadugiControllerOccupiedSeatObservationV3Draft(six)])
      .toEqual([...v2(six)]);
  });

  it('fails closed without an occupied actor, button or opponent', () => {
    expect(() => buildBadugiControllerOccupiedSeatObservationV3Draft(
      input([player(), empty()], 0, 0))).toThrow(/occupied actor and button/);
    expect(() => buildBadugiControllerOccupiedSeatObservationV3Draft(
      input([player(), { ...player(10), occupied: false }], 0, 1)))
      .toThrow(/occupied actor and button/);
  });
});
