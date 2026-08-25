import { analyzeBetSnapshot, needsActionForBet } from "./flow/betRoundUtils.js";

function clonePlayer(player) {
  if (!player) return player;
  return { ...player };
}

function contributionOf(player = {}) {
  return Math.max(
    0,
    Number(player.betThisStreet ?? player.betThisRound ?? player.bet ?? player.committed ?? 0) || 0,
  );
}

function isFolded(player = {}) {
  return Boolean(player.folded || player.hasFolded);
}

function isSeatOut(player = {}) {
  return Boolean(player.seatOut || player.isBusted || player.busted);
}

function isAllIn(player = {}) {
  return Boolean(player.allIn || player.isAllIn);
}

function activeSeats(players = []) {
  return players.flatMap((player, seat) =>
    player && !isFolded(player) && !isSeatOut(player) ? [seat] : [],
  );
}

function foldedSeats(players = []) {
  return players.flatMap((player, seat) => (isFolded(player) ? [seat] : []));
}

function allInSeats(players = []) {
  return players.flatMap((player, seat) => (isAllIn(player) ? [seat] : []));
}

function contributionsBySeat(players = []) {
  return Object.fromEntries(players.map((player, seat) => [seat, contributionOf(player)]));
}

export function playersNeedingBadugiBetAction(players = [], currentBet = null) {
  const maxBet =
    currentBet == null
      ? Math.max(0, ...players.map((player) => contributionOf(player)))
      : Math.max(0, Number(currentBet) || 0);
  return players.flatMap((player, seat) => (needsActionForBet(player, maxBet) ? [seat] : []));
}

export function shouldBadugiBetRoundClose(players = [], currentBet = null) {
  return playersNeedingBadugiBetAction(players, currentBet).length === 0;
}

export function buildBadugiActionAuditEntry({
  handId = null,
  phase = "BET",
  drawRound = 0,
  betRound = null,
  actionIndex = 0,
  actorSeat = null,
  actorName = null,
  action = null,
  amount = null,
  before = {},
  after = {},
} = {}) {
  const beforePlayers = (before.players ?? []).map(clonePlayer);
  const afterPlayers = (after.players ?? []).map(clonePlayer);
  const beforeActor = typeof actorSeat === "number" ? beforePlayers[actorSeat] : null;
  const afterActor = typeof actorSeat === "number" ? afterPlayers[actorSeat] : null;
  const currentBetBefore =
    before.currentBet ?? Math.max(0, ...beforePlayers.map((player) => contributionOf(player)));
  const currentBetAfter =
    after.currentBet ?? Math.max(0, ...afterPlayers.map((player) => contributionOf(player)));
  const playersNeedingActionBefore = playersNeedingBadugiBetAction(
    beforePlayers,
    currentBetBefore,
  );
  const playersNeedingActionAfter = playersNeedingBadugiBetAction(afterPlayers, currentBetAfter);
  const analysisAfter = analyzeBetSnapshot({
    players: afterPlayers,
    actedIndex: actorSeat,
    dealerIdx: after.dealerIdx ?? before.dealerIdx ?? 0,
    drawRound: after.drawRound ?? before.drawRound ?? drawRound,
    betHead: after.betHead ?? before.betHead ?? null,
    lastAggressorIdx: after.lastAggressorIdx ?? before.lastAggressorIdx ?? null,
  });

  return {
    handId,
    phase,
    drawRound,
    betRound,
    actionIndex,
    actorSeat,
    actorName: actorName ?? beforeActor?.name ?? afterActor?.name ?? null,
    action,
    amount,
    currentBetBefore,
    currentBetAfter,
    contributionBefore: contributionOf(beforeActor),
    contributionAfter: contributionOf(afterActor),
    actedThisRoundBefore: Boolean(beforeActor?.hasActedThisRound),
    actedThisRoundAfter: Boolean(afterActor?.hasActedThisRound),
    activeSeats: activeSeats(afterPlayers),
    foldedSeats: foldedSeats(afterPlayers),
    allInSeats: allInSeats(afterPlayers),
    playersNeedingActionBefore,
    playersNeedingActionAfter,
    expectedNextActor: analysisAfter.nextTurn ?? null,
    actualNextActor:
      typeof after.turn === "number"
        ? after.turn
        : typeof after.nextTurn === "number"
        ? after.nextTurn
        : typeof after.metadata?.actingPlayerIndex === "number"
        ? after.metadata.actingPlayerIndex
        : null,
    shouldRoundClose: analysisAfter.shouldAdvance || playersNeedingActionAfter.length === 0,
    isOrderValid:
      playersNeedingActionAfter.length === 0 ||
      (typeof after.turn === "number" ? after.turn : after.nextTurn) === analysisAfter.nextTurn,
    contributions: contributionsBySeat(afterPlayers),
  };
}

export function buildBadugiRoundCloseAudit({
  handId = null,
  players = [],
  currentBet = null,
  actualTransition = null,
} = {}) {
  const maxBet =
    currentBet == null
      ? Math.max(0, ...players.map((player) => contributionOf(player)))
      : Math.max(0, Number(currentBet) || 0);
  const pending = playersNeedingBadugiBetAction(players, maxBet);
  return {
    event: "BET_ROUND_CLOSE_CHECK",
    handId,
    currentBet: maxBet,
    contributions: contributionsBySeat(players),
    actedThisRound: Object.fromEntries(
      players.map((player, seat) => [seat, Boolean(player?.hasActedThisRound)]),
    ),
    foldedSeats: foldedSeats(players),
    allInSeats: allInSeats(players),
    playersNeedingAction: pending,
    shouldClose: pending.length === 0,
    actualTransition,
  };
}
