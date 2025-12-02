import { isFoldedOrOut, nextAliveFrom, maxBetThisRound } from "./actionUtils.js";

export function needsActionForBet(player, maxBet = 0) {
  if (!player || isFoldedOrOut(player) || player.allIn) return false;
  const bet =
    typeof player.betThisRound === "number"
      ? player.betThisRound
      : typeof player.bet === "number"
      ? player.bet
      : 0;
  const hasActed =
    typeof player.hasActedThisRound === "boolean"
      ? player.hasActedThisRound
      : Boolean(player.lastAction || player.lastAct);
  return bet < maxBet || !hasActed;
}

export function isBetRoundComplete(players) {
  if (!Array.isArray(players)) return false;
  const eligible = players.filter(
    (player) => player && !isFoldedOrOut(player) && !player.allIn
  );
  if (eligible.length <= 1) {
    return true;
  }
  const maxNow = maxBetThisRound(players);
  return !players.some((player) => needsActionForBet(player, maxNow));
}

export function closingSeatForAggressor(players, lastAggressorIdx) {
  if (!Array.isArray(players)) return null;
  if (lastAggressorIdx === null || typeof lastAggressorIdx === "undefined") {
    return null;
  }
  const agg = players[lastAggressorIdx];
  if (!agg) return null;
  if (isFoldedOrOut(agg) || agg.allIn) {
    const next = nextAliveFrom(players, lastAggressorIdx);
    if (next === null) return null;
    return next;
  }
  return lastAggressorIdx;
}

export function analyzeBetSnapshot({
  players = [],
  actedIndex = 0,
  dealerIdx = 0,
  drawRound = 0,
  numPlayers = players.length || 6,
  betHead = null,
  lastAggressorIdx = null,
}) {
  const snap = players.map((p) => ({ ...p }));
  const maxNow = maxBetThisRound(snap);
  const active = snap.filter((p) => !isFoldedOrOut(p));
  const everyoneMatched = active.every(
    (p) => p.allIn || (p.betThisRound || 0) === maxNow,
  );
  const allChecked =
    maxNow === 0 &&
    active.every((p) => isFoldedOrOut(p) || p.allIn || p.lastAction === "Check");
  const searchStart = typeof actedIndex === "number" ? actedIndex + 1 : 0;
  const hasPendingAction = snap.some((player) => needsActionForBet(player, maxNow));

  // Debug: snapshot of players prior to selecting nextTurn
  console.log("[BET][PLAYERS]", {
    actedIndex,
    maxNow,
    players: snap.map((p, idx) => ({
      idx,
      name: p.name,
      folded: p.folded,
      allIn: p.allIn,
      betThisRound: p.betThisRound,
      bet: p.bet,
      lastAction: p.lastAction,
      hasActedThisRound: p.hasActedThisRound,
    })),
  });

  const nextTurn = hasPendingAction ? findNextBetActorSeat(snap, searchStart, maxNow) : null;
  const closingSeatCandidate = closingSeatForAggressor(snap, lastAggressorIdx);
  const fallbackSeat = typeof betHead === "number" ? betHead : null;
  const closingSeat = closingSeatCandidate ?? fallbackSeat;
  const returnedToAggressor =
    typeof closingSeat === "number" && nextTurn === closingSeat;

  const bbIndex = (dealerIdx + 2) % (numPlayers || snap.length || 1);
  const bbSeat = snap[bbIndex];
  let isBBActed = true;
  if (drawRound === 0 && bbSeat) {
    const acted = ["Bet", "Call", "Raise", "Check"].includes(bbSeat.lastAction);
    isBBActed = bbSeat.folded || bbSeat.allIn || acted;
  }

  const isHeadsUp = active.length <= 2;
  const betRoundSatisfied = !hasPendingAction;
  const shouldAdvance = betRoundSatisfied;

  return {
    playersSnapshot: snap,
    nextTurn,
    maxBet: maxNow,
    everyoneMatched,
    allChecked,
    betRoundSatisfied,
    closingSeat,
    returnedToAggressor,
    shouldAdvance,
    isHeadsUp,
    isBBActed,
  };
}

function findNextBetActorSeat(snapshotOrPlayers, startIdx = 0, maxBet = 0) {
  // Works with either a snapshot object or raw players array
  const players = Array.isArray(snapshotOrPlayers)
    ? snapshotOrPlayers
    : snapshotOrPlayers && Array.isArray(snapshotOrPlayers.players)
    ? snapshotOrPlayers.players
    : [];

  if (players.length === 0) return null;

  const n = players.length;
  const normalizedStart = ((startIdx % n) + n) % n;

  for (let offset = 0; offset < n; offset += 1) {
    const seat = (normalizedStart + offset) % n;
    const player = players[seat];
    if (!player || isFoldedOrOut(player) || player.allIn) continue;

    const needsAction = needsActionForBet(player, maxBet);

    console.log('[BET][CANDIDATE]', {
      seat,
      name: player.name,
      bet: player.betThisRound ?? player.bet ?? 0,
      maxBet,
      hasActed: player.hasActedThisRound,
      folded: player.folded,
      allIn: player.allIn,
      needsAction,
    });

    if (needsAction) {
      return seat;
    }
  }

  return null;
}

