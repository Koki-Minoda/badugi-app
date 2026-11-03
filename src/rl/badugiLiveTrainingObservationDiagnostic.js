// Offline diagnostic only. Do not connect this projection to published models
// until its inputs and resulting policy have independent live-session evidence.
import { buildBadugiTrainingObservationV1 } from './badugiTrainingObservationV1.js';

const RANKS = 'A23456789TJQK';
const SUITS = 'CDHS';

function cardTuple(card) {
  const match = typeof card === 'string'
    ? card.trim().toUpperCase().match(/^([2-9]|10|[AJQK])([CDHS])$/)
    : null;
  if (!match) throw new TypeError('Badugi diagnostic requires a valid own card');
  const rank = match[1] === '10' ? 'T' : match[1];
  return [RANKS.indexOf(rank), SUITS.indexOf(match[2])];
}

function actionRound(event, currentRound) {
  const round = event?.drawRoundIndex;
  if (!Number.isInteger(round) || round < 0 || round > 3 || round > currentRound ||
      event.betRoundIndex !== round) {
    throw new TypeError('Badugi diagnostic requires explicit, consistent action round tags');
  }
  return round;
}

export function buildBadugiLiveTrainingObservationDiagnostic({
  players, events, seatIndex, phase, drawRoundIndex, dealerIndex,
  bigBlind, raiseCount, currentBet, legalActions,
}) {
  if (!Array.isArray(players) || players.length !== 6 || !Array.isArray(events) ||
      !Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= 6 ||
      !Number.isInteger(dealerIndex) || dealerIndex < 0 || dealerIndex >= 6 ||
      !Number.isInteger(drawRoundIndex) || drawRoundIndex < 0 || drawRoundIndex > 3 ||
      !['BET', 'DRAW'].includes(phase) || !Number.isFinite(bigBlind) || bigBlind <= 0 ||
      !Number.isFinite(raiseCount) || !Number.isFinite(currentBet) ||
      !Array.isArray(legalActions)) {
    throw new TypeError('Badugi diagnostic requires a complete six-seat decision state');
  }
  const opened = Array.from({ length: 6 }, () => [false, false, false, false]);
  const draws = Array.from({ length: 6 }, () => [0, 0, 0]);
  const lastDraw = Array(6).fill(0);
  const discardedOwn = [];
  for (const event of events) {
    if (event?.type !== 'BET_ACTION' && event?.type !== 'DRAW_ACTION') continue;
    const round = actionRound(event, drawRoundIndex);
    const seat = event.seat;
    if (!Number.isInteger(seat) || seat < 0 || seat >= 6) {
      throw new TypeError('Badugi diagnostic requires valid action seats');
    }
    if (event.type === 'BET_ACTION') {
      if (event.action === 'bet' || event.action === 'raise') opened[seat][round] = true;
      continue;
    }
    if (round >= 3 || !Number.isInteger(event.drawCount) ||
        event.drawCount < 0 || event.drawCount > 4) {
      throw new TypeError('Badugi diagnostic requires valid draw counts');
    }
    draws[seat][round] = event.drawCount;
    lastDraw[seat] = event.drawCount;
    if (seat === seatIndex) {
      const replaced = event.replacedCards;
      if (!Array.isArray(replaced) || replaced.length !== event.drawCount) {
        throw new TypeError('Badugi diagnostic requires the actor\'s exact discarded-card history');
      }
      discardedOwn.push(...replaced.map((entry) => cardTuple(entry.oldCard)));
    }
  }
  const scale = 2 / bigBlind; // The six-max trainer used BB=2 chip units.
  const mappedPlayers = players.map((player, seat) => {
    if (!player || !Number.isFinite(player.stack) || !Number.isFinite(player.betThisRound) ||
        !Number.isFinite(player.totalInvested)) {
      throw new TypeError('Badugi diagnostic requires complete player chip state');
    }
    const observedLastDraw = player.lastDrawCount;
    if (Number.isInteger(observedLastDraw) && observedLastDraw !== lastDraw[seat]) {
      throw new TypeError('Badugi diagnostic draw history differs from controller state');
    }
    const completed = opened[seat].slice(0, 3).map((value, round) =>
      round < drawRoundIndex || (phase === 'DRAW' && round === drawRoundIndex) ? value : false);
    return {
      stack: player.stack * scale,
      betThisRound: player.betThisRound * scale,
      folded: Boolean(player.folded || player.hasFolded),
      hand: seat === seatIndex ? (player.hand ?? []).map(cardTuple) : [],
      betHistory: completed,
      drawHistory: draws[seat],
      lastDrawCount: lastDraw[seat],
      openedCurrentRound: phase === 'BET' ? opened[seat][drawRoundIndex] : false,
      discardedCards: seat === seatIndex ? discardedOwn : [],
    };
  });
  const state = {
    players: mappedPlayers,
    phase,
    drawRoundIndex,
    dealerIndex,
    currentBet: currentBet * scale,
    raiseCount,
    pot: players.reduce((sum, player) => sum + player.totalInvested, 0) * scale,
    betQueue: phase === 'BET' ? [seatIndex] : [],
  };
  const vector = buildBadugiTrainingObservationV1({ state, seatIndex, legalActions });
  if (vector.length !== 96 || !vector.every(Number.isFinite)) {
    throw new TypeError('Badugi diagnostic produced an invalid 96-slot observation');
  }
  return vector;
}
