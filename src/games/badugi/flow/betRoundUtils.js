import {
  isFoldedOrOut,
  nextAliveFrom,
  maxBetThisRound,
  isPlayerInBetRound,
  getBlindSeatsForPlayers,
} from "./actionUtils.js";
import {
  findNextEligibleActor,
  isSeatEligibleForBetting,
} from "../../core/turn/actorEligibility.js";
import { debugLog } from "../../../utils/debugLog.js";

export function needsActionForBet(player, maxBet = 0) {
  if (!player || !isPlayerInBetRound(player)) return false;
  return isSeatEligibleForBetting(player, { phase: "BET", currentBet: maxBet, players: [player] });
}

export function isBetRoundComplete(stateOrPlayers) {
  if (!stateOrPlayers) return false;
  const players = Array.isArray(stateOrPlayers)
    ? stateOrPlayers
    : Array.isArray(stateOrPlayers.players)
    ? stateOrPlayers.players
    : [];
  const currentBet =
    typeof stateOrPlayers?.currentBet === "number"
      ? stateOrPlayers.currentBet
      : maxBetThisRound(players);
  for (const player of players) {
    if (!isPlayerInBetRound(player)) {
      continue;
    }
    if (player?.allIn) {
      continue;
    }
    if (!player?.hasActedThisRound) return false;
    const bet =
      typeof player?.betThisRound === "number"
        ? player.betThisRound
        : typeof player?.bet === "number"
        ? player.bet
        : 0;
    if (bet !== currentBet) return false;
  }
  return true;
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
  debugLog("[BET][PLAYERS]", `actedIndex=${actedIndex} maxNow=${maxNow}`, {
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

  const bbIndex =
    getBlindSeatsForPlayers(snap, dealerIdx).bbIdx ??
    (dealerIdx + 2) % (numPlayers || snap.length || 1);
  const bbSeat = snap[bbIndex];
  let isBBActed = true;
  if (drawRound === 0 && bbSeat) {
    const acted = ["Bet", "Call", "Raise", "Check"].includes(bbSeat.lastAction);
    isBBActed = bbSeat.folded || bbSeat.allIn || acted;
  }

  const isHeadsUp = active.length <= 2;
  const betRoundSatisfied = isBetRoundComplete({ players: snap, currentBet: maxNow });
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

export function findNextBetActorSeat(snapshotOrPlayers, startIdx = 0, maxBet = 0) {
  // Works with either a snapshot object or raw players array
  const players = Array.isArray(snapshotOrPlayers)
    ? snapshotOrPlayers
    : snapshotOrPlayers && Array.isArray(snapshotOrPlayers.players)
    ? snapshotOrPlayers.players
    : [];

  if (players.length === 0) return null;

  return findNextEligibleActor(
    { phase: "BET", players, currentBet: maxBet },
    { phase: "BET", startIndex: startIdx },
  );
}
