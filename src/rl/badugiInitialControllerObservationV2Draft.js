// First-decision controller probe only. Later decisions require an audited
// public-event projection; do not substitute zero histories for them.
import {
  BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT,
  buildBadugiControllerObservationV2Draft,
} from './badugiControllerObservationV2Draft.js';
import { deriveBadugiControllerPublicChipStateV2Draft } from './badugiControllerPublicChipStateV2Draft.js';

export function buildBadugiInitialControllerObservationV2Draft({
  controller, state, seatIndex, isTournament,
}) {
  if (!controller || typeof controller.getUiSnapshot !== 'function' ||
      typeof controller.getLegalActions !== 'function' || !state) {
    throw new TypeError('v2 draft requires a real controller state');
  }
  const snapshot = controller.getUiSnapshot(state);
  const players = snapshot?.players;
  if (!Array.isArray(players) || ![2, 3, 6].includes(players.length) ||
      snapshot.phase !== 'BET' || Number(snapshot.drawRound ?? snapshot.drawRoundIndex) !== 0 ||
      !Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= players.length) {
    throw new TypeError('v2 initial probe requires a 2/3/6-seat first BET decision');
  }
  const actor = players[seatIndex];
  const legal = controller.getLegalActions(state, seatIndex).map((action) => action.type);
  if (legal.length === 0 || !Array.isArray(actor?.hand) || actor.hand.length !== 4 ||
      players.some((player) => (player?.lastDrawCount ?? 0) !== 0 ||
        (player?.openedCurrentRound ?? false))) {
    throw new TypeError('v2 initial probe requires unplayed controller history');
  }
  const dealerIndex = snapshot.dealerIdx ?? snapshot.dealerSeat ?? snapshot.metadata?.dealerIdx;
  const { bigBlind, currentBet, pot, raiseCount } =
    deriveBadugiControllerPublicChipStateV2Draft(controller, snapshot);
  return buildBadugiControllerObservationV2Draft({
    schemaVersion: BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT,
    players: players.map((player) => ({
      occupied: !(player?.seatOut || player?.sittingOut || player?.isBusted || player?.busted),
      inHand: !(player?.seatOut || player?.sittingOut || player?.isBusted ||
        player?.busted || player?.folded || player?.hasFolded),
      allIn: Boolean(player?.allIn),
      stack: player?.stack,
      betThisRound: player?.betThisRound,
      lastDrawKnown: false, lastDrawCount: 0, openedCurrentRound: false,
      priorAggression: false, cumulativeDrawCount: 0,
    })),
    seatIndex, dealerIndex, phase: 'BET', drawRoundIndex: 0,
    bigBlind, currentBet, pot, raiseCount, firstToAct: true,
    isTournament, controllerLegalActions: legal,
    ownCards: actor.hand, ownDiscardedCards: [],
    ownBetHistory: [false, false, false], ownDrawHistory: [0, 0, 0],
  });
}
