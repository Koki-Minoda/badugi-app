// Candidate-only observation. Existing v2 weights and public routing remain unchanged.
// Occupied seats include folded players; the in-hand count remains a separate feature.
import {
  BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT,
  BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT_SLOTS,
  buildBadugiControllerObservationV2Draft,
} from './badugiControllerObservationV2Draft.js';

export const BADUGI_CONTROLLER_OCCUPIED_SEAT_OBSERVATION_V3_DRAFT =
  'badugi-controller-occupied-seat-observation-v3-draft';

export const BADUGI_CONTROLLER_OCCUPIED_SEAT_OBSERVATION_V3_DRAFT_SLOTS =
  Object.freeze(BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT_SLOTS.map((slot, index) => {
    if (index === 10) return 'occupied_seat_count_over_6';
    if (index === 12) return 'button_relative_occupied_position';
    return slot;
  }));

export function buildBadugiControllerOccupiedSeatObservationV3Draft(input) {
  if (input?.schemaVersion !== BADUGI_CONTROLLER_OCCUPIED_SEAT_OBSERVATION_V3_DRAFT) {
    throw new TypeError('occupied-seat v3 draft schema version required');
  }
  const { players, seatIndex, dealerIndex } = input;
  if (!Array.isArray(players) || ![2, 3, 6].includes(players.length) ||
      !Number.isInteger(seatIndex) || !Number.isInteger(dealerIndex) ||
      seatIndex < 0 || seatIndex >= players.length ||
      dealerIndex < 0 || dealerIndex >= players.length) {
    throw new TypeError('occupied-seat v3 draft requires valid seats');
  }
  const occupied = players.flatMap((player, index) => player?.occupied === true ? [index] : []);
  if (occupied.length < 2 || !occupied.includes(seatIndex) || !occupied.includes(dealerIndex)) {
    throw new TypeError('occupied-seat v3 draft requires an occupied actor and button');
  }

  // Reuse the validated actor-only v2 encoding, then change only the layout
  // features. No opponent private card, deck or strategy field is read here.
  const vector = buildBadugiControllerObservationV2Draft({
    ...input, schemaVersion: BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT,
  });
  const blocks = Array.from({ length: players.length - 1 }, (_, offset) => ({
    seat: (seatIndex + offset + 1) % players.length,
    values: vector.slice(44 + offset * 10, 54 + offset * 10),
  }));
  const occupiedBlocks = blocks.filter(({ seat }) => players[seat].occupied);
  vector[10] = occupied.length / 6;
  vector[12] = ((occupied.indexOf(seatIndex) - occupied.indexOf(dealerIndex) - 1 +
    occupied.length) % occupied.length) / (occupied.length - 1);
  vector.fill(0, 44, 94);
  occupiedBlocks.forEach(({ values }, index) => vector.set(values, 44 + index * 10));
  return vector;
}
