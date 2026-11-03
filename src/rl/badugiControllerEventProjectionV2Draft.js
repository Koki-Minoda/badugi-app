// D03 offline draft. Project one controller decision using public hand events
// and the acting player's own cards/discards. Never pass this to old weights.
import {
  BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT,
  buildBadugiControllerObservationV2Draft,
} from './badugiControllerObservationV2Draft.js';
import { deriveBadugiControllerPublicChipStateV2Draft } from './badugiControllerPublicChipStateV2Draft.js';

function actionRound(event, decisionRound) {
  const round = event?.drawRoundIndex;
  if (!Number.isInteger(round) || round < 0 || round > decisionRound ||
      round > 3 || event.betRoundIndex !== round) {
    throw new TypeError('v2 draft requires matching public event round tags');
  }
  return round;
}

export function buildBadugiControllerEventObservationV2Draft({
  controller, state, seatIndex, publicEvents, isTournament,
}) {
  if (!controller || typeof controller.getUiSnapshot !== 'function' ||
      typeof controller.getLegalActions !== 'function' ||
      !Array.isArray(publicEvents)) {
    throw new TypeError('v2 draft requires controller and public events');
  }
  const snapshot = controller.getUiSnapshot(state);
  const players = snapshot?.players;
  const drawRoundIndex = snapshot?.drawRound ?? snapshot?.drawRoundIndex;
  const phase = snapshot?.phase;
  if (!Array.isArray(players) || ![2, 3, 6].includes(players.length) ||
      !Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= players.length ||
      !Number.isInteger(drawRoundIndex) || drawRoundIndex < 0 || drawRoundIndex > 3 ||
      !['BET', 'DRAW'].includes(phase)) {
    throw new TypeError('v2 draft requires a 2/3/6-seat controller decision');
  }
  const betHistory = Array.from({ length: players.length }, () => [false, false, false, false]);
  const drawHistory = Array.from({ length: players.length }, () => [0, 0, 0]);
  const drawSeen = Array.from({ length: players.length }, () => [false, false, false]);
  const ownDiscardedCards = [];
  let betActionsThisRound = 0;
  for (const event of publicEvents) {
    if (event?.type !== 'BET_ACTION' && event?.type !== 'DRAW_ACTION') continue;
    const round = actionRound(event, drawRoundIndex);
    const seat = event.seat;
    if (!Number.isInteger(seat) || seat < 0 || seat >= players.length) {
      throw new TypeError('v2 draft requires valid public event seats');
    }
    if (event.type === 'BET_ACTION') {
      const action = String(event.action).toLowerCase();
      if (!['fold', 'check', 'call', 'bet', 'raise'].includes(action)) {
        throw new TypeError('v2 draft requires an unambiguous public bet action');
      }
      if (phase === 'BET' && round === drawRoundIndex) betActionsThisRound += 1;
      if (['bet', 'raise'].includes(action)) {
        betHistory[seat][round] = true;
      }
      continue;
    }
    if (round >= 3 || round >= drawRoundIndex ||
        !Number.isInteger(event.drawCount) ||
        event.drawCount < 0 || event.drawCount > 4 || drawSeen[seat][round]) {
      throw new TypeError('v2 draft requires one valid public draw per seat and round');
    }
    drawHistory[seat][round] = event.drawCount;
    drawSeen[seat][round] = true;
    if (seat === seatIndex) {
      if (!Array.isArray(event.replacedCards) ||
          event.replacedCards.length !== event.drawCount) {
        throw new TypeError('v2 draft requires the actor\'s complete discard history');
      }
      ownDiscardedCards.push(...event.replacedCards.map((entry) => entry.oldCard));
    }
  }
  const actor = players[seatIndex];
  if (!Array.isArray(actor?.hand) || actor.hand.length !== 4) {
    throw new TypeError('v2 draft requires the actor\'s four cards');
  }
  for (let seat = 0; seat < players.length; seat += 1) {
    const player = players[seat];
    const stillInHand = player && !(player.seatOut || player.sittingOut ||
      player.isBusted || player.busted || player.folded || player.hasFolded);
    if (!stillInHand) continue;
    for (let round = 0; round < Math.min(drawRoundIndex, 3); round += 1) {
      if (!drawSeen[seat][round]) {
        throw new TypeError('v2 draft requires complete public draw events for live seats');
      }
    }
  }
  const dealerIndex = snapshot.dealerIdx ?? snapshot.dealerSeat ?? snapshot.metadata?.dealerIdx;
  const { bigBlind, currentBet, pot, raiseCount } =
    deriveBadugiControllerPublicChipStateV2Draft(controller, snapshot);
  const publicPlayers = players.map((player, seat) => {
    const occupied = !(player?.seatOut || player?.sittingOut || player?.isBusted || player?.busted);
    const inHand = occupied && !(player?.folded || player?.hasFolded);
    const knownRound = drawSeen[seat].findLastIndex((seen, round) =>
      seen && round < drawRoundIndex);
    const lastDrawKnown = knownRound >= 0;
    const lastDrawCount = lastDrawKnown ? drawHistory[seat][knownRound] : 0;
    const reportedLastDraw = player?.lastDrawCount;
    if (lastDrawKnown && Number.isInteger(reportedLastDraw) &&
        reportedLastDraw !== lastDrawCount) {
      throw new TypeError('v2 draft public draw events disagree with controller state');
    }
    return {
      occupied, inHand, allIn: Boolean(player?.allIn),
      stack: player?.stack, betThisRound: player?.betThisRound,
      lastDrawKnown, lastDrawCount,
      openedCurrentRound: phase === 'BET' && betHistory[seat][drawRoundIndex],
      priorAggression: betHistory[seat].slice(0, drawRoundIndex).some(Boolean),
      cumulativeDrawCount: drawHistory[seat].reduce((sum, count) => sum + count, 0),
    };
  });
  const ownBetHistory = betHistory[seatIndex].slice(0, 3).map((value, round) =>
    round < drawRoundIndex || phase === 'DRAW' && round === drawRoundIndex ? value : false);
  const ownDrawHistory = drawHistory[seatIndex];
  return buildBadugiControllerObservationV2Draft({
    schemaVersion: BADUGI_CONTROLLER_OBSERVATION_V2_DRAFT,
    players: publicPlayers, seatIndex, dealerIndex, phase, drawRoundIndex,
    bigBlind, currentBet, pot, raiseCount,
    firstToAct: phase === 'BET' && betActionsThisRound === 0,
    isTournament,
    controllerLegalActions: controller.getLegalActions(state, seatIndex).map((action) => action.type),
    ownCards: actor.hand, ownDiscardedCards, ownBetHistory, ownDrawHistory,
  });
}
