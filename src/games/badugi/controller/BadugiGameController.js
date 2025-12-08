// src/games/badugi/controller/BadugiGameController.js
import { GameController } from "../../core/GameController.js";
import LegacyBadugiController from "../BadugiGameController.js";
import { analyzeBetSnapshot } from "../flow/betRoundUtils.js";
import { maxBetThisRound, isFoldedOrOut } from "../flow/actionUtils.js";
import { getWinnersByBadugi } from "../utils/badugiEvaluator.js";

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

function normalizeSeatIndex(idx, total) {
  if (!Number.isFinite(idx) || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  return ((idx % total) + total) % total;
}

function findNextDrawableSeat(players = [], { startIndex = null, dealerIdx = 0 } = {}) {
  const seatCount = Array.isArray(players) ? players.length : 0;
  if (!seatCount) return null;
  const base =
    typeof startIndex === "number"
      ? normalizeSeatIndex(startIndex, seatCount)
      : normalizeSeatIndex((dealerIdx ?? 0) + 1, seatCount);
  if (base == null) return null;
  for (let offset = 0; offset < seatCount; offset += 1) {
    const idx = (base + offset) % seatCount;
    const player = players[idx];
    const needsAction =
      player &&
      !isFoldedOrOut(player) &&
      !player.seatOut &&
      !player.hasDrawn;
    if (needsAction) {
      return idx;
    }
  }
  return null;
}

function deriveLegalActions(snapshot, seatIndex) {
  const players = snapshot?.players ?? [];
  const player = players[seatIndex];
  if (!player || isFoldedOrOut(player)) {
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

  if (!player.allIn && player.stack > 0) {
    baseActions.push({ type: "RAISE" });
  }

  const isDrawPhase = snapshot?.phase === "DRAW";
  if (isDrawPhase && !player.hasDrawn && !player.allIn) {
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
      events.push({ type: "invalidAction", error: result?.error ?? "action rejected" });
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

    const drawCount = this._resolveDrawCount(payload, actor);
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
    this.legacy.state.metadata = {
      ...(this.legacy.state.metadata ?? {}),
      lastDraw: {
        seatIndex,
        drawCount,
        replacedCards,
      },
    };

    const events = [];
    if (nextSeat == null) {
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

  _buildControllerState({ handIndex, context, overrideSnapshot = null }) {
    const snapshotSource = overrideSnapshot ?? this.legacy.getSnapshot();
    const builtState = {
      handIndex,
      context,
      snapshot: cloneSnapshot(snapshotSource),
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
        : typeof metadata.actingPlayerIndex === "number"
        ? metadata.actingPlayerIndex
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
