import { analyzeBetSnapshot } from "./flow/betRoundUtils.js";
import {
  isFoldedOrOut,
  isSeatEligibleForBet,
  isSeatEligibleForDraw,
  maxBetThisRound,
} from "./flow/actionUtils.js";

function normalizePhase(value) {
  return value == null ? null : String(value).toUpperCase();
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clonePlayers(players = []) {
  return Array.isArray(players) ? players.map((player) => ({ ...(player ?? {}) })) : [];
}

function playerSeat(player, fallbackSeat) {
  return numberOrNull(player?.seatIndex ?? player?.seat) ?? fallbackSeat;
}

export function buildBadugiBetToDrawTransitionTrace({
  before = {},
  after = {},
  mode = null,
  actedIndex = null,
  closeReason = null,
  transitionCalled = null,
  transitionResult = null,
} = {}) {
  const players = clonePlayers(before.players ?? after.players ?? []);
  const drawRound = numberOrNull(before.drawRound ?? before.drawRoundIndex ?? after.drawRound);
  const betRound = numberOrNull(before.betRound ?? before.betRoundIndex ?? after.betRound);
  const currentBet =
    numberOrNull(before.currentBet ?? before.metadata?.currentBet) ?? maxBetThisRound(players);
  const dealerIdx = numberOrNull(before.dealerIdx ?? before.dealerSeat ?? before.buttonSeat) ?? 0;
  const analysis = analyzeBetSnapshot({
    players,
    actedIndex: numberOrNull(actedIndex ?? before.actedIndex ?? before.turn ?? before.nextTurn) ?? 0,
    dealerIdx,
    drawRound: drawRound ?? 0,
    betHead: before.betHead ?? before.metadata?.betHead ?? null,
    lastAggressorIdx: before.lastAggressorIdx ?? before.metadata?.lastAggressor ?? null,
  });
  const playersNeedingAction = players
    .map((player, seat) => ({ player, seat }))
    .filter(({ player }) => isSeatEligibleForBet(player))
    .filter(({ player }) => {
      const bet = numberOrNull(player?.betThisRound ?? player?.bet) ?? 0;
      return bet < currentBet || !player?.hasActedThisRound;
    })
    .map(({ player, seat }) => playerSeat(player, seat));
  const expectedNextPhase =
    analysis.shouldAdvance && (drawRound ?? 0) < 3 ? "DRAW" : analysis.shouldAdvance ? "SHOWDOWN" : "BET";
  const actualNextPhase = normalizePhase(after.phase ?? after.street ?? before.phase);
  const activeNonAllIn = players.filter(
    (player) => player && !isFoldedOrOut(player) && !player.allIn,
  ).length;
  const activeHandEligible = players.filter((player) => player && !isFoldedOrOut(player)).length;

  return {
    handId: before.handId ?? after.handId ?? null,
    mode,
    street: normalizePhase(before.phase ?? before.street),
    drawRound,
    betRound,
    currentBet,
    pot: numberOrNull(before.pot ?? after.pot) ?? 0,
    actor: before.turn ?? before.currentActor ?? before.nextTurn ?? null,
    nextTurn: before.nextTurn ?? null,
    phaseStateTurn: before.phaseStateTurn ?? null,
    metadataActingPlayerIndex: before.metadata?.actingPlayerIndex ?? null,
    players: players.map((player, seat) => {
      const folded = isFoldedOrOut(player);
      const allIn = Boolean(player?.allIn);
      return {
        seat: playerSeat(player, seat),
        folded,
        allIn,
        out: Boolean(player?.seatOut || player?.isBusted || player?.isActiveInGame === false),
        betThisRound: numberOrNull(player?.betThisRound ?? player?.bet) ?? 0,
        totalInvested: numberOrNull(player?.totalInvested) ?? 0,
        hasActedThisRound: Boolean(player?.hasActedThisRound),
        needsBetAction: playersNeedingAction.includes(playerSeat(player, seat)),
        eligibleForBet: isSeatEligibleForBet(player),
        eligibleForDraw: isSeatEligibleForDraw(player),
      };
    }),
    needsActionForBet: playersNeedingAction.length > 0,
    playersNeedingAction,
    activeNonAllIn,
    activeHandEligible,
    lastAggressor: before.lastAggressorIdx ?? before.metadata?.lastAggressor ?? null,
    shouldCloseBetRound: analysis.shouldAdvance,
    closeReason:
      closeReason ??
      (analysis.shouldAdvance
        ? "all_matched_or_folded"
        : playersNeedingAction.length
          ? "pending_bet_action"
          : "unknown"),
    expectedNextPhase,
    actualNextPhase,
    transitionCalled: Boolean(transitionCalled),
    transitionResult,
  };
}

export function recordBadugiBetToDrawTransitionTrace(entry) {
  if (typeof window === "undefined") return entry;
  const trace = Array.isArray(window.__MGX_BADUGI_BET_TO_DRAW_TRACE__)
    ? window.__MGX_BADUGI_BET_TO_DRAW_TRACE__
    : [];
  trace.push({ timestamp: Date.now(), ...(entry ?? {}) });
  window.__MGX_BADUGI_BET_TO_DRAW_TRACE__ = trace.slice(-500);
  return entry;
}
