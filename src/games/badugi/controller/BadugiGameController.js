// src/games/badugi/controller/BadugiGameController.js
import { GameController } from "../../core/GameController.js";
import {
  getAuthoritativeActorIndex,
  normalizeTurnState,
} from "../../core/turn/actorEligibility.js";
import LegacyBadugiController from "../BadugiGameController.js";
import { analyzeBetSnapshot } from "../flow/betRoundUtils.js";
import {
  maxBetThisRound,
  nextAliveFrom,
  isFoldedOrOut,
  findNextDrawActorSeat,
  isSeatEligibleForDraw,
} from "../flow/actionUtils.js";
import { getWinnersByBadugi } from "../utils/badugiEvaluator.js";
import { normalizeDrawAction } from "../../core/draw/normalizeDrawAction.js";

const DEFAULT_SEAT_CONFIG = ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"];
const DEFAULT_BLINDS = [{ sb: 5, bb: 10, ante: 0 }];

function cloneSnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== "object") return {};
  return {
    ...snapshot,
    metadata:
      snapshot && typeof snapshot.metadata === "object"
        ? { ...snapshot.metadata }
        : undefined,
    players: Array.isArray(snapshot.players)
      ? snapshot.players.map((player) =>
          player ? { ...player, hand: [...(player.hand ?? [])] } : player,
        )
      : [],
    pots: Array.isArray(snapshot.pots)
      ? snapshot.pots.map((pot) => ({
          ...pot,
          eligible: pot?.eligible ? [...pot.eligible] : [],
        }))
      : [],
  };
}

function clonePlayers(players = []) {
  if (!Array.isArray(players)) return [];
  return players.map((player) =>
    player
      ? {
          ...player,
          hand: Array.isArray(player.hand) ? [...player.hand] : player.hand,
        }
      : player,
  );
}

function findNextDrawableSeat(players = [], { startIndex = null, dealerIdx = 0 } = {}) {
  const seatCount = Array.isArray(players) ? players.length : 0;
  if (!seatCount) return null;
  const normalizedBase =
    typeof startIndex === "number"
      ? startIndex
      : ((dealerIdx ?? 0) + 1) % seatCount;
  return findNextDrawActorSeat(players, normalizedBase);
}

function deriveLegalActions(snapshot, seatIndex) {
  const players = snapshot?.players ?? [];
  const player = players[seatIndex];
  if (!player || isFoldedOrOut(player)) {
    return [];
  }
  if (getAuthoritativeActorIndex(snapshot) !== seatIndex) {
    return [];
  }

  const currentBet = maxBetThisRound(players);
  const betThisRound =
    typeof player.betThisRound === "number"
      ? player.betThisRound
      : typeof player.bet === "number"
      ? player.bet
      : 0;

  const baseActions = [{ type: "FOLD" }];
  if (betThisRound >= currentBet) {
    baseActions.push({ type: "CHECK" });
  } else {
    baseActions.push({ type: "CALL" });
  }

  const metadata = snapshot?.metadata ?? {};
  const raiseCount = Math.max(
    0,
    Number(snapshot?.raiseCountThisRound ?? metadata.raiseCountThisRound) || 0,
  );
  const raiseCap = Math.max(
    0,
    Number(snapshot?.raiseCap ?? metadata.raiseCap ?? 4) || 4,
  );

  if (!player.allIn && player.stack > 0 && raiseCount < raiseCap) {
    baseActions.push({ type: "RAISE" });
  }

  const isDrawPhase = snapshot?.phase === "DRAW";
  if (isDrawPhase && isSeatEligibleForDraw(player) && !player.hasDrawn) {
    baseActions.push({ type: "DRAW" });
  }

  return baseActions;
}

export class BadugiGameController extends GameController {
  constructor(config = {}) {
    super();
    this.config = {
      numSeats: config.numSeats ?? DEFAULT_SEAT_CONFIG.length,
      seatConfig: config.seatConfig ?? DEFAULT_SEAT_CONFIG,
      startingStack: config.startingStack ?? 500,
      heroProfile: config.heroProfile ?? {},
      blindStructure: config.blindStructure ?? DEFAULT_BLINDS,
      lastStructureIndex:
        config.lastStructureIndex ??
        Math.max(0, (config.blindStructure?.length ?? DEFAULT_BLINDS.length) - 1),
    };
    this.legacy = new LegacyBadugiController({
      numSeats: this.config.numSeats,
      blindStructure: this.config.blindStructure,
      lastStructureIndex: this.config.lastStructureIndex,
      evaluateHand: config.evaluateHand ?? null,
    });
    this._lastState = null;
  }

  createInitialState(tableConfig = {}) {
    this._applyTableConfig(tableConfig);
    return this._buildControllerState({
      handIndex: 0,
      context: null,
    });
  }

  createNewHandState(prevState = {}, options = {}) {
    this._applyTableConfig(options);
    const nextDealer = this._resolveDealerIndex(prevState, options);
    const startPayload = this.legacy.startNewHand({
      prevPlayers: options.prevPlayers ?? prevState?.snapshot?.players ?? null,
      currentPlayers: options.currentPlayers ?? [],
      numSeats: this.config.numSeats,
      seatConfig: options.seatConfig ?? this.config.seatConfig,
      startingStack: options.startingStack ?? this.config.startingStack,
      heroProfile: options.heroProfile ?? this.config.heroProfile,
      nextDealerIdx: nextDealer,
      blindStructure: options.blindStructure ?? this.config.blindStructure,
      blindState: options.blindState ?? {
        blindLevelIndex: this.legacy.state.blindLevelIndex ?? 0,
        handsInLevel: this.legacy.state.handsInLevel ?? 0,
      },
      lastStructureIndex:
        options.lastStructureIndex ??
        this.config.lastStructureIndex ??
        Math.max(0, (this.config.blindStructure?.length ?? DEFAULT_BLINDS.length) - 1),
      drawCardsForSeat: options.drawCardsForSeat ?? null,
    });

    return this._buildControllerState({
      handIndex: (prevState?.handIndex ?? 0) + 1,
      context: startPayload,
    });
  }

  getUiSnapshot(state = {}) {
    if (state?.snapshot) {
      return cloneSnapshot(state.snapshot);
    }
    return cloneSnapshot(this.legacy.getSnapshot());
  }

  getLegalActions(state = {}, seatIndex) {
    const snapshot = state?.snapshot ?? this.legacy.getSnapshot();
    if (typeof seatIndex !== "number") return [];
    return deriveLegalActions(snapshot, seatIndex);
  }

  applyAction(state = {}, action = {}) {
    if (typeof action.seatIndex !== "number") {
      return { state, events: [{ type: "error", message: "seatIndex is required" }] };
    }
    const referenceState = state?.snapshot ? state : this._lastState;
    const { seatIndex } = action;
    const payload = action.payload ?? action.metadata ?? {};
    const normalizedType =
      typeof payload.type === "string" && payload.type.length
        ? payload.type.toLowerCase()
        : "call";

    if (normalizedType === "draw") {
      return this._applyDrawAction({ referenceState, seatIndex, payload });
    }

    const result = this.legacy.applyPlayerAction({
      seatIndex,
      payload: { ...payload, type: normalizedType },
      betSize: action.betSize ?? this.config.betSize,
      players: action.players ?? null,
    });
    const events = [];
    if (!result?.success) {
      events.push({
        type: "invalidAction",
        error: result?.error ?? "action rejected",
        code: result?.code ?? null,
      });
      return { state, events };
    }

    const advanceSnapshot = this.legacy.advanceStreet({
      players: this.legacy.state.players,
      actedIndex: seatIndex,
      dealerIdx: this.legacy.state.dealerIdx,
      drawRound: this.legacy.state.drawRound,
      betHead: this.legacy.state.betHead,
      lastAggressorIdx: this.legacy.state.lastAggressorIdx,
    });
    if (advanceSnapshot?.shouldAdvance) {
      this._finishBetRound();
      events.push({ type: "betRoundComplete" });
    }
    const nextState = this._buildControllerState({
      handIndex: referenceState?.handIndex ?? 0,
      context: referenceState?.context ?? null,
    });
    return { state: nextState, events };
  }

  isStreetFinished(state = {}) {
    const snapshot = state?.snapshot ?? this.legacy.getSnapshot();
    const analysis = analyzeBetSnapshot({
      players: snapshot.players ?? [],
      actedIndex: snapshot.nextTurn ?? snapshot.betHead ?? 0,
      dealerIdx: snapshot.dealerIdx ?? 0,
      drawRound: snapshot.drawRound ?? snapshot.drawRoundIndex ?? 0,
      betHead: snapshot.betHead ?? null,
      lastAggressorIdx: snapshot.lastAggressorIdx ?? null,
    });
    return Boolean(analysis?.shouldAdvance);
  }

  isHandFinished(state = {}) {
    const snapshot = state?.snapshot ?? this.legacy.getSnapshot();
    return Boolean(snapshot?.phase === "SHOWDOWN" || snapshot?.lastHandResult);
  }

  getWinners(state = {}) {
    const snapshot = state?.snapshot ?? this.legacy.getSnapshot();
    if (snapshot?.lastHandResult?.results) {
      return snapshot.lastHandResult.results;
    }
    const players = snapshot?.players ?? [];
    return getWinnersByBadugi(players);
  }

  encodeForRL(state = {}, seatIndex) {
    void state;
    void seatIndex;
    return [];
  }

  _applyDrawAction({ referenceState, seatIndex, payload = {} }) {
    const baseState = referenceState ?? this._lastState ?? null;
    const handIndex = baseState?.handIndex ?? 0;
    const context = baseState?.context ?? null;
    const playersSource =
      referenceState?.snapshot?.players ?? this.legacy.state.players ?? [];
    const players = clonePlayers(playersSource);
    const actor = players[seatIndex];
    if (!actor) {
      const fallbackState = baseState ?? this._buildControllerState({ handIndex, context });
      return {
        state: fallbackState,
        events: [{ type: "invalidAction", error: "seat not found" }],
      };
    }

    let normalizedDraw;
    try {
      normalizedDraw = normalizeDrawAction({
        action: payload,
        player: { ...actor, seatIndex },
        state: {
          phase: "DRAW",
          drawRoundIndex: this.legacy.state.drawRound ?? 0,
          maxDiscardCount: 4,
        },
        variant: { handCardCount: 4 },
      });
    } catch (error) {
      const fallbackState = baseState ?? this._buildControllerState({ handIndex, context });
      return {
        state: fallbackState,
        events: [
          {
            type: "invalidAction",
            error: error?.message ?? "invalid draw action",
            meta: error?.meta ?? null,
          },
        ],
      };
    }
    const drawCount = normalizedDraw.drawCount;
    const beforeHand = Array.isArray(actor.hand) ? [...actor.hand] : [];
    const nextHand = Array.isArray(payload.handAfter)
      ? [...payload.handAfter]
      : Array.isArray(actor.hand)
      ? [...actor.hand]
      : [];
    actor.hand = nextHand;
    actor.hasDrawn = true;
    actor.lastDrawCount = drawCount;
    actor.lastAction = payload.actionLabel ?? (drawCount > 0 ? `DRAW(${drawCount})` : "Pat");
    actor.selected = [];
    actor.drawRequest = 0;
    actor.hasActedThisRound = true;

    const dealerIdx =
      referenceState?.snapshot?.dealerIdx ?? this.legacy.state.dealerIdx ?? 0;
    const nextSeatOverride =
      typeof payload.nextTurn === "number" ? payload.nextTurn : null;
    const nextSeat = findNextDrawableSeat(players, {
      startIndex: nextSeatOverride != null ? nextSeatOverride : seatIndex + 1,
      dealerIdx,
    });

    this.legacy.state.players = clonePlayers(players);
    this.legacy.state.turn = nextSeat ?? null;
    this.legacy.state.nextTurn = nextSeat ?? null;
    this.legacy.state.phase = payload.phase ?? this.legacy.state.phase ?? "DRAW";
    if (typeof payload.drawRound === "number") {
      this.legacy.state.drawRound = payload.drawRound;
    }
    const replacedCards = Array.isArray(payload.replacedCards)
      ? payload.replacedCards.map((entry) => ({ ...entry }))
      : [];
    const discarded = normalizedDraw.discardIndexes.map((idx) => beforeHand[idx]);
    const drawn = replacedCards.map((entry) => entry?.newCard).filter(Boolean);
    const keptCards = beforeHand.filter((_, idx) => !normalizedDraw.discardIndexes.includes(idx));
    this.legacy.state.metadata = {
      ...(this.legacy.state.metadata ?? {}),
      lastDraw: {
        seatIndex,
        drawCount,
        discardIndexes: normalizedDraw.discardIndexes,
        drawIndexes: normalizedDraw.discardIndexes,
        discarded,
        drawn,
        keptCards,
        replacedCards,
        beforeHand,
        afterHand: nextHand,
        warnings: normalizedDraw.drawNormalization?.warnings ?? [],
      },
    };

    const events = [];
    if (nextSeat == null) {
      this._finishDrawRound(players, dealerIdx);
      events.push({ type: "drawRoundComplete" });
    } else {
      events.push({ type: "turnChanged", seatIndex: nextSeat });
    }

    const nextState = this._buildControllerState({
      handIndex,
      context,
    });
    return { state: nextState, events };
  }

  _resolveDrawCount(payload = {}, actor = null) {
    if (typeof payload.drawCount === "number") {
      return Math.max(0, payload.drawCount);
    }
    if (Array.isArray(payload.drawIndexes)) {
      return payload.drawIndexes.length;
    }
    if (Array.isArray(payload.replacedCards)) {
      return payload.replacedCards.length;
    }
    if (typeof actor?.lastDrawCount === "number") {
      return Math.max(0, actor.lastDrawCount);
    }
    return 0;
  }

  _finishBetRound() {
    const players = (this.legacy.state.players ?? []).map((player) => ({
      ...player,
      betThisRound: 0,
      hasActedThisRound: Boolean(player.folded || player.seatOut || player.allIn),
    }));
    this.legacy.state.players = players;
    this.legacy.state.currentBet = 0;
    this.legacy.state.betHead = null;
    this.legacy.state.lastAggressorIdx = null;
    this.legacy.state.raiseCountThisRound = 0;
    if ((this.legacy.state.drawRound ?? 0) >= 3) {
      this.legacy.state.phase = "SHOWDOWN";
      this.legacy.state.turn = null;
      this.legacy.state.nextTurn = null;
      this._resolveShowdownAndApplyPayouts();
      return;
    }

    this.legacy.state.phase = "DRAW";
    const dealerIdx = this.legacy.state.dealerIdx ?? 0;
    const nextTurn = findNextDrawableSeat(players, { dealerIdx });
    this.legacy.state.turn = nextTurn;
    this.legacy.state.nextTurn = nextTurn;
    if (nextTurn == null) {
      this._finishDrawRound(players, dealerIdx);
    }
  }

  _finishDrawRound(players = [], dealerIdx = 0) {
    const currentDrawRound = this.legacy.state.drawRound ?? 0;
    if (currentDrawRound >= 3) {
      this.legacy.state.phase = "SHOWDOWN";
      this.legacy.state.turn = null;
      this.legacy.state.nextTurn = null;
      this._resolveShowdownAndApplyPayouts();
      return;
    }

    const nextPlayers = players.map((player) => ({
      ...player,
      betThisRound: 0,
      hasActedThisRound: Boolean(player.folded || player.seatOut || player.allIn),
      hasDrawn: false,
    }));
    this.legacy.state.players = nextPlayers;
    this.legacy.state.phase = "BET";
    this.legacy.state.drawRound = currentDrawRound + 1;
    this.legacy.state.currentBet = 0;
    this.legacy.state.betHead = null;
    this.legacy.state.lastAggressorIdx = null;
    this.legacy.state.raiseCountThisRound = 0;
    const nextTurn = nextAliveFrom(nextPlayers, dealerIdx);
    this.legacy.state.turn = nextTurn;
    this.legacy.state.nextTurn = nextTurn;
    if (nextTurn == null) {
      this._finishBetRound();
    }
  }

  _resolveShowdownAndApplyPayouts() {
    const players = this.legacy.state.players ?? [];
    const contenders = players.filter((player) => player && !player.folded && !player.seatOut);
    const winners = getWinnersByBadugi(contenders).filter(
      (winner) => typeof winner.seatIndex === "number",
    );
    const totalPot = players.reduce(
      (sum, player) => sum + Math.max(0, Number(player?.totalInvested) || 0),
      0,
    );
    const basePayout = winners.length ? Math.floor(totalPot / winners.length) : 0;
    let remainder = winners.length ? totalPot - basePayout * winners.length : 0;
    const payouts = winners
      .sort((left, right) => left.seatIndex - right.seatIndex)
      .map((winner) => {
        const extra = remainder > 0 ? 1 : 0;
        remainder -= extra;
        const payout = basePayout + extra;
        const player = players[winner.seatIndex];
        if (player) {
          player.stack = Math.max(0, Number(player.stack) || 0) + payout;
        }
        return { ...winner, payout };
      });
    this.legacy.resolveShowdown({
      players,
      summary: [{ potIndex: 0, potAmount: totalPot, payouts }],
      totalPot,
      handId: this.legacy.state.handId,
    });
  }

  _buildControllerState({ handIndex, context, overrideSnapshot = null }) {
    const snapshotSource = overrideSnapshot ?? this.legacy.getSnapshot();
    const normalizedSnapshot = normalizeTurnState(cloneSnapshot(snapshotSource), {
      phase: snapshotSource?.phase,
      allowAllInDraw: true,
    });
    const builtState = {
      handIndex,
      context,
      snapshot: normalizedSnapshot,
      lastEvents: [],
    };
    this._lastState = builtState;
    return builtState;
  }

  _applyTableConfig(partial = {}) {
    const merged = {
      ...this.config,
      ...partial,
    };
    if (!merged.seatConfig || merged.seatConfig.length === 0) {
      merged.seatConfig = DEFAULT_SEAT_CONFIG;
    }
    if (!merged.blindStructure || merged.blindStructure.length === 0) {
      merged.blindStructure = DEFAULT_BLINDS;
    }
    if (partial.seatConfig && partial.numSeats == null) {
      merged.numSeats = merged.seatConfig.length;
    }
    merged.numSeats = merged.numSeats ?? merged.seatConfig.length;
    merged.lastStructureIndex =
      merged.lastStructureIndex ?? Math.max(0, merged.blindStructure.length - 1);
    this.config = merged;
    this.legacy.updateConfig({
      numSeats: merged.numSeats,
      blindStructure: merged.blindStructure,
      lastStructureIndex: merged.lastStructureIndex,
    });
  }

  _resolveDealerIndex(prevState = {}, options = {}) {
    if (typeof options.nextDealerIdx === "number") {
      return options.nextDealerIdx;
    }
    const prevDealer = prevState?.snapshot?.dealerIdx ?? this.legacy.state.dealerIdx ?? 0;
    if ((prevState?.handIndex ?? 0) === 0 && !prevState?.context) {
      return prevDealer;
    }
    const seats = this.config.numSeats ?? DEFAULT_SEAT_CONFIG.length;
    return (prevDealer + 1) % seats;
  }

  syncFromExternalState({ snapshot = {}, context = null, handIndex = null } = {}) {
    const normalized = cloneSnapshot(snapshot);
    const metadata = normalized.metadata ?? {};
    const dealerIdx =
      normalized.dealerIdx ??
      normalized.dealerSeat ??
      metadata.dealerIdx ??
      metadata.dealerSeat ??
      this.legacy.state.dealerIdx ??
      0;
    const nextTurn =
      typeof normalized.nextTurn === "number"
        ? normalized.nextTurn
        : typeof normalized.turn === "number"
        ? normalized.turn
        : this.legacy.state.turn ?? this.legacy.state.nextTurn ?? 0;

    this.legacy.syncExternalState({
      players: normalized.players ?? [],
      dealerIdx,
      blindLevelIndex:
        normalized.blindLevelIndex ??
        metadata.blindLevelIndex ??
        this.legacy.state.blindLevelIndex ??
        0,
      handsInLevel:
        normalized.handsInLevel ??
        metadata.handsInLevel ??
        this.legacy.state.handsInLevel ??
        0,
      betHead:
        normalized.betHead ??
        metadata.betHead ??
        this.legacy.state.betHead ??
        null,
      lastAggressorIdx:
        normalized.lastAggressor ??
        metadata.lastAggressor ??
        this.legacy.state.lastAggressorIdx ??
        null,
      currentBet:
        normalized.currentBet ??
        metadata.currentBet ??
        this.legacy.state.currentBet ??
        0,
      raiseCountThisRound:
        normalized.raiseCountThisRound ??
        metadata.raiseCountThisRound ??
        this.legacy.state.raiseCountThisRound ??
        0,
      raiseCap:
        normalized.raiseCap ??
        metadata.raiseCap ??
        this.legacy.state.raiseCap ??
        null,
      phase: normalized.phase ?? metadata.phase ?? this.legacy.state.phase ?? "BET",
      drawRound:
        normalized.drawRound ??
        metadata.drawRound ??
        this.legacy.state.drawRound ??
        0,
      turn: nextTurn,
      nextTurn,
    });

    const resolvedHandIndex =
      typeof handIndex === "number"
        ? handIndex
        : this._lastState?.handIndex ??
          this.legacy.state.handIndex ??
          0;

    const baseSnapshot = this.legacy.getSnapshot();
    const overrideSnapshot =
      metadata && Object.keys(metadata).length
        ? { ...baseSnapshot, metadata: { ...metadata } }
        : baseSnapshot;

    return this._buildControllerState({
      handIndex: resolvedHandIndex,
      context: context ?? this._lastState?.context ?? null,
      overrideSnapshot,
    });
  }
}

export default BadugiGameController;
