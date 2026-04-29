// src/games/badugi/BadugiGameController.js
import { buildNextHandState } from "./flow/handLifecycle.js";
import {
  applyForcedBetActionSnapshot,
  maxBetThisRound,
} from "./flow/actionUtils.js";
import { analyzeBetSnapshot } from "./flow/betRoundUtils.js";
import { buildHandResultSummary } from "./flow/handResultUtils.js";
import { getFixedLimitBetSize } from "./logic/bettingRules.js";
import { validateAction } from "./engine/BadugiEngine.js";

function clonePlayer(player) {
  if (!player) return player;
  const next = { ...player };
  if (Array.isArray(player.hand)) next.hand = [...player.hand];
  if (Array.isArray(player.selected)) next.selected = [...player.selected];
  return next;
}

export class BadugiGameController {
  constructor({
    numSeats = 6,
    blindStructure = [],
    lastStructureIndex = 0,
    evaluateHand = null,
  } = {}) {
    this.config = {
      numSeats,
      blindStructure,
      lastStructureIndex,
      evaluateHand,
      betSize: 0,
    };
    this.state = {
      players: [],
      dealerIdx: 0,
      blindLevelIndex: 0,
      handsInLevel: 0,
      betHead: null,
      lastAggressorIdx: null,
      currentBet: 0,
      drawRound: 0,
      phase: "BET",
      handId: null,
      nextTurn: null,
      sbIndex: null,
      bbIndex: null,
      raiseCountThisRound: 0,
      raiseCap: null,
    };
  }

  updateConfig(partial = {}) {
    this.config = {
      ...this.config,
      ...partial,
    };
  }

  syncExternalState(partial = {}) {
    if (partial.players) {
      this.state.players = partial.players.map(clonePlayer);
    }
    const nextRaiseCount =
      partial.raiseCountThisRound ??
      partial?.metadata?.raiseCountThisRound ??
      this.state.raiseCountThisRound;
    const nextRaiseCap =
      partial.raiseCap ??
      partial?.metadata?.raiseCap ??
      this.state.raiseCap;
    this.state = {
      ...this.state,
      ...partial,
      raiseCountThisRound: Math.max(0, Number(nextRaiseCount) || 0),
      raiseCap: nextRaiseCap ?? null,
    };
  }

  setHandContext({ handId } = {}) {
    if (handId) {
      this.state.handId = handId;
    }
  }

  getSnapshot() {
    return {
      ...this.state,
      players: this.state.players.map(clonePlayer),
    };
  }

  startNewHand({
    prevPlayers = null,
    currentPlayers = [],
    numSeats = this.config.numSeats,
    seatConfig = [],
    startingStack = 0,
    heroProfile = {},
    nextDealerIdx = 0,
    blindStructure = this.config.blindStructure,
    blindState = { blindLevelIndex: 0, handsInLevel: 0 },
    lastStructureIndex = this.config.lastStructureIndex,
    drawCardsForSeat = null,
  } = {}) {
    const nextHandState = buildNextHandState({
      prevPlayers,
      currentPlayers,
      numSeats,
      seatConfig,
      startingStack,
      heroProfile,
      nextDealerIdx,
      blindStructure,
      blindState,
      lastStructureIndex,
      drawCardsForSeat,
    });

    this.state.players = nextHandState.players.map(clonePlayer);
    this.state.dealerIdx = nextDealerIdx;
    this.state.sbIndex = nextHandState.sbIdx ?? null;
    this.state.bbIndex = nextHandState.bbIdx ?? null;
    this.state.blindLevelIndex = nextHandState.blindLevelIndex;
    this.state.handsInLevel = nextHandState.handsInLevel;
    this.state.betHead = nextHandState.resolvedTurn;
    this.state.nextTurn = nextHandState.resolvedTurn;
    this.state.lastAggressorIdx = nextHandState.bbIdx ?? null;
    this.state.currentBet = nextHandState.initialCurrentBet ?? 0;
    this.state.drawRound = 0;
    this.state.phase = "BET";
    this.state.raiseCountThisRound = 0;
    this.config.betSize = nextHandState.blindValues?.bb ?? this.config.betSize;

    return { ...nextHandState };
  }

  applyPlayerAction({
    seatIndex,
    payload = {},
    betSize = this.config.betSize,
    players: explicitPlayers = null,
  } = {}) {
    if (typeof seatIndex !== "number") {
      return { success: false };
    }
    const sourcePlayers = explicitPlayers
      ? explicitPlayers.map(clonePlayer)
      : this.state.players.map(clonePlayer);
    const streetBetSize = getFixedLimitBetSize({
      baseBet: betSize,
      drawRound: this.state.drawRound ?? 0,
    });
    const normalizedType =
      typeof payload?.type === "string" && payload.type.length
        ? payload.type.toUpperCase()
        : "CALL";
    const validation = validateAction(
      {
        players: sourcePlayers,
        bigBlind: Number(betSize) || Number(this.config.betSize) || 0,
        smallBlind: Math.max(0, Math.floor((Number(betSize) || Number(this.config.betSize) || 0) / 2)),
        drawRoundIndex: this.state.drawRound ?? 0,
        betRoundIndex: this.state.drawRound ?? 0,
        metadata: {
          raiseCountThisRound: this.state.raiseCountThisRound ?? 0,
          raiseCap: this.state.raiseCap ?? this.config.raiseCap ?? null,
          bbValue: Number(betSize) || Number(this.config.betSize) || 0,
        },
      },
      seatIndex,
      {
        type: normalizedType,
        amount: payload?.amount,
      },
    );
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.message ?? "invalid action",
        code: validation.code ?? null,
      };
    }

    const payloadForApply = {
      ...(payload ?? {}),
      type: String(normalizedType).toLowerCase(),
    };
    delete payloadForApply.raiseCap;
    delete payloadForApply.raiseCountThisRound;
    if (
      (normalizedType === "CALL" || normalizedType === "RAISE" || normalizedType === "BET") &&
      Number.isFinite(validation.expectedContribution)
    ) {
      payloadForApply.amount = validation.expectedContribution;
    }

    const result = applyForcedBetActionSnapshot({
      players: sourcePlayers,
      seat: seatIndex,
      payload: payloadForApply,
      betSize: streetBetSize,
    });
    if (!result.success) {
      return result;
    }
    this.state.players = result.updatedPlayers.map(clonePlayer);
    this.state.currentBet = maxBetThisRound(this.state.players);
    if (result.raiseApplied) {
      this.state.betHead = seatIndex;
      this.state.lastAggressorIdx = seatIndex;
      this.state.raiseCountThisRound = Math.max(
        0,
        Number(this.state.raiseCountThisRound) || 0,
      ) + 1;
    }
    return result;
  }

  advanceStreet({
    players = this.state.players,
    actedIndex = 0,
    dealerIdx = this.state.dealerIdx,
    drawRound = this.state.drawRound,
    betHead = this.state.betHead,
    lastAggressorIdx = this.state.lastAggressorIdx,
  } = {}) {
    const snapshot = analyzeBetSnapshot({
      players,
      actedIndex,
      dealerIdx,
      drawRound,
      betHead,
      lastAggressorIdx,
    });
    this.state.players = players.map(clonePlayer);
    this.state.currentBet = snapshot.maxBet ?? this.state.currentBet;
    this.state.betHead = betHead ?? this.state.betHead;
    this.state.lastAggressorIdx =
      typeof lastAggressorIdx === "number" ? lastAggressorIdx : this.state.lastAggressorIdx;
    this.state.drawRound = drawRound;
    this.state.nextTurn = snapshot.nextTurn ?? null;
    if (snapshot?.shouldAdvance) {
      this.state.raiseCountThisRound = 0;
    }
    return snapshot;
  }

  resolveShowdown({
    players = this.state.players,
    summary = [],
    totalPot = 0,
    handId = this.state.handId,
    evaluateHand = this.config.evaluateHand,
  } = {}) {
    const result = buildHandResultSummary({
      players,
      summary,
      totalPot,
      handId,
      evaluateHand,
      buttonSeat: this.state.dealerIdx ?? null,
      sbSeat: this.state.sbIndex ?? null,
      bbSeat: this.state.bbIndex ?? null,
    });
    this.state.lastHandResult = result;
    return result;
  }
}

export default BadugiGameController;
