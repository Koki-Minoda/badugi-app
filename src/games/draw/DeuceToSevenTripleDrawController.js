import { GameController } from "../core/GameController.js";
import { DeuceToSevenTripleDrawEngine } from "./DeuceToSevenTripleDrawEngine.js";

const DEFAULT_SEAT_CONFIG = ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"];
const DEFAULT_STRUCTURE = { sb: 10, bb: 20, ante: 0 };

function clonePlayer(player) {
  if (!player) return player;
  return {
    ...player,
    hand: Array.isArray(player.hand) ? [...player.hand] : [],
    selected: Array.isArray(player.selected) ? [...player.selected] : [],
  };
}

function cloneState(state = {}) {
  return {
    ...state,
    players: Array.isArray(state.players) ? state.players.map(clonePlayer) : [],
    pots: Array.isArray(state.pots) ? state.pots.map((pot) => ({ ...pot })) : [],
    metadata: { ...(state.metadata ?? {}) },
  };
}

function toUiPlayer(player) {
  const hand = Array.isArray(player?.hand) ? [...player.hand] : [];
  return {
    ...clonePlayer(player),
    hand,
    selected: Array.isArray(player?.selected) ? [...player.selected] : [],
    cards: hand,
    betThisRound: player?.bet ?? player?.betThisRound ?? 0,
    isActiveInGame: !player?.sittingOut && !player?.seatOut,
  };
}

function sumPots(pots = []) {
  return pots.reduce((sum, pot) => sum + Math.max(0, pot?.amount ?? 0), 0);
}

function buildHandResultSummary({ showdownSummary = [], totalPot = 0, handId = null } = {}) {
  const potDetails = (Array.isArray(showdownSummary) ? showdownSummary : []).map((pot, potIndex) => {
    const winners = (Array.isArray(pot?.payouts) ? pot.payouts : []).map((winner) => ({
      seatIndex: winner.seatIndex,
      name: winner.name,
      payout: winner.payout ?? 0,
      stack: winner.stackAfter,
      handLabel: winner.handName ?? winner.handLabel ?? "2-7 Low",
      ranksLabel: winner.ranksLabel ?? "",
      hand: Array.isArray(winner.hand) ? [...winner.hand] : [],
      activeCards: Array.isArray(winner.activeCards) ? [...winner.activeCards] : [],
      deadCards: Array.isArray(winner.deadCards) ? [...winner.deadCards] : [],
    }));
    return {
      potIndex: pot.potIndex ?? potIndex,
      potAmount: Math.max(0, pot.potAmount ?? pot.amount ?? 0),
      winners,
    };
  });
  const winnersBySeat = new Map();
  potDetails.flatMap((pot) => pot.winners).forEach((winner) => {
    if (typeof winner.seatIndex !== "number") return;
    const current = winnersBySeat.get(winner.seatIndex);
    winnersBySeat.set(
      winner.seatIndex,
      current
        ? {
            ...current,
            payout: (current.payout ?? 0) + (winner.payout ?? 0),
          }
        : { ...winner },
    );
  });
  return {
    handId,
    pot: Math.max(0, totalPot ?? potDetails.reduce((sum, pot) => sum + pot.potAmount, 0)),
    winners: Array.from(winnersBySeat.values()),
    potDetails,
    results: showdownSummary,
  };
}

function normalizeAction(action = {}) {
  const payload = action.payload ?? action.metadata ?? action;
  const type = String(payload.type ?? action.type ?? "").toUpperCase();
  return {
    ...payload,
    ...action,
    type,
    discardIndexes: Array.isArray(payload.discardIndexes)
      ? [...payload.discardIndexes]
      : Array.isArray(payload.drawIndexes)
      ? [...payload.drawIndexes]
      : Array.isArray(action.discardIndexes)
      ? [...action.discardIndexes]
      : [],
  };
}

function buildEvent(beforeState, afterState, action = {}) {
  if (afterState?.isHandOver && !beforeState?.isHandOver) {
    return {
      type: "handComplete",
      summary: afterState?.metadata?.showdownSummary ?? [],
      totalPot: afterState?.metadata?.showdownTotal ?? 0,
    };
  }
  if (beforeState?.street === "BET" && afterState?.street === "DRAW") {
    return { type: "betRoundComplete", drawRound: afterState.drawRoundIndex ?? 0 };
  }
  if (beforeState?.street === "DRAW" && afterState?.street === "BET") {
    return { type: "drawRoundComplete", drawRound: afterState.drawRoundIndex ?? 0 };
  }
  if (String(action?.type ?? "").toUpperCase() === "DRAW") {
    return {
      type: "drawAction",
      seatIndex: action.seatIndex,
      drawCount: action.discardIndexes?.length ?? 0,
    };
  }
  return {
    type: "actionApplied",
    seatIndex: action.seatIndex,
    actionType: action.type,
  };
}

function deriveLegalActions(state = {}, seatIndex) {
  const player = state.players?.[seatIndex];
  if (!player || player.folded || player.sittingOut || player.seatOut || player.allIn) {
    return [];
  }
  if (state.actingPlayerIndex !== null && state.actingPlayerIndex !== seatIndex) {
    return [];
  }
  if (state.street === "DRAW") {
    return player.hasDrawn ? [] : [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }];
  }
  if (state.street !== "BET") return [];
  const currentBet = Math.max(
    state.metadata?.currentBet ?? 0,
    ...state.players.map((entry) => entry?.bet ?? 0),
  );
  const playerBet = player.bet ?? 0;
  const actions = [{ type: "FOLD" }];
  actions.push(playerBet >= currentBet ? { type: "CHECK" } : { type: "CALL" });
  if ((player.stack ?? 0) > 0) {
    actions.push({ type: currentBet > 0 ? "RAISE" : "BET" });
  }
  return actions;
}

export class DeuceToSevenTripleDrawController extends GameController {
  constructor({ engine = null, tableConfig = {} } = {}) {
    super();
    this.engine = engine ?? new DeuceToSevenTripleDrawEngine();
    this.config = {
      seatConfig: tableConfig.seatConfig ?? DEFAULT_SEAT_CONFIG,
      startingStack: tableConfig.startingStack ?? 500,
      structure: tableConfig.structure ?? DEFAULT_STRUCTURE,
      heroProfile: tableConfig.heroProfile ?? {},
      dealerIndex: tableConfig.dealerIndex ?? 0,
    };
    this._lastState = null;
    this._handCounter = 0;
  }

  createInitialState(tableConfig = {}) {
    this.config = {
      ...this.config,
      ...tableConfig,
      structure: { ...this.config.structure, ...(tableConfig.structure ?? {}) },
    };
    const state = {
      handIndex: 0,
      engineState: null,
      snapshot: this.getUiSnapshot(null),
      lastEvents: [],
    };
    this._lastState = state;
    return state;
  }

  createNewHandState(prevState = {}, options = {}) {
    const config = {
      ...this.config,
      ...options,
      structure: { ...this.config.structure, ...(options.structure ?? {}) },
    };
    this.config = config;
    this._handCounter += 1;
    const handId = options.handId ?? `d01-hand-${this._handCounter}`;
    const raw = this.engine.initHand({
      handId,
      seatConfig: config.seatConfig,
      startingStack: config.startingStack,
      heroProfile: config.heroProfile,
      dealerIndex:
        typeof options.dealerIndex === "number"
          ? options.dealerIndex
          : config.dealerIndex,
      structure: config.structure,
    });
    const engineState = this.engine.applyForcedBets(raw);
    const state = {
      handIndex: (prevState?.handIndex ?? 0) + 1,
      engineState: cloneState(engineState),
      snapshot: this.getUiSnapshot(engineState),
      lastEvents: [{ type: "handStarted", handId }],
    };
    this._lastState = state;
    return state;
  }

  getUiSnapshot(state = null) {
    const source = state?.engineState ?? state ?? this._lastState?.engineState ?? null;
    if (!source) {
      return {
        gameId: "deuce_to_seven_triple_draw",
        variantId: "D01",
        phase: "IDLE",
        street: "IDLE",
        drawRound: 0,
        drawRoundIndex: 0,
        players: [],
        pot: 0,
        pots: [],
        turn: null,
        nextTurn: null,
        actingPlayerIndex: null,
        maxDiscardCount: 5,
        handCardCount: 5,
        lastHandResult: null,
        metadata: {},
      };
    }
    const cloned = cloneState(source);
    const metadata = { ...(cloned.metadata ?? {}) };
    const showdownSummary = metadata.showdownSummary ?? null;
    const lastHandResult = showdownSummary
      ? buildHandResultSummary({
          showdownSummary,
          totalPot: metadata.showdownTotal ?? 0,
          handId: cloned.handId,
        })
      : null;
    return {
      ...cloned,
      gameId: cloned.gameId,
      variantId: metadata.variantId ?? "D01",
      phase: cloned.street,
      street: cloned.street,
      drawRound: cloned.drawRoundIndex ?? 0,
      drawRoundIndex: cloned.drawRoundIndex ?? 0,
      players: cloned.players.map(toUiPlayer),
      pot: metadata.potAmount ?? sumPots(cloned.pots),
      pots: cloned.pots.map((pot) => ({ ...pot })),
      turn: cloned.actingPlayerIndex,
      nextTurn: cloned.actingPlayerIndex,
      actingPlayerIndex: cloned.actingPlayerIndex,
      currentBet: metadata.currentBet ?? 0,
      maxDiscardCount: 5,
      handCardCount: 5,
      lastHandResult,
      metadata,
    };
  }

  getLegalActions(state = {}, seatIndex) {
    const engineState = state?.engineState ?? this._lastState?.engineState ?? state;
    if (typeof seatIndex !== "number") return [];
    return deriveLegalActions(engineState ?? {}, seatIndex);
  }

  applyAction(state = {}, action = {}) {
    const engineState = cloneState(state?.engineState ?? this._lastState?.engineState ?? {});
    const normalizedAction = normalizeAction(action);
    if (typeof normalizedAction.seatIndex !== "number") {
      return { state, events: [{ type: "invalidAction", error: "seatIndex is required" }] };
    }
    try {
      const nextEngineState = this.engine.applyPlayerAction(engineState, normalizedAction);
      const events = [buildEvent(engineState, nextEngineState, normalizedAction)];
      const nextState = {
        handIndex: state?.handIndex ?? this._lastState?.handIndex ?? 0,
        engineState: cloneState(nextEngineState),
        snapshot: this.getUiSnapshot(nextEngineState),
        lastEvents: events,
      };
      this._lastState = nextState;
      return { state: nextState, events };
    } catch (error) {
      return {
        state,
        events: [
          {
            type: "invalidAction",
            error: error?.message ?? "action rejected",
            meta: error?.meta ?? null,
          },
        ],
      };
    }
  }

  isStreetFinished(state = {}) {
    const snapshot = state?.snapshot ?? this.getUiSnapshot(state?.engineState ?? state);
    return snapshot.phase === "DRAW" || snapshot.phase === "SHOWDOWN";
  }

  isHandFinished(state = {}) {
    const engineState = state?.engineState ?? this._lastState?.engineState ?? state;
    return Boolean(engineState?.isHandOver || engineState?.street === "SHOWDOWN");
  }

  getWinners(state = {}) {
    const snapshot = state?.snapshot ?? this.getUiSnapshot(state?.engineState ?? state);
    return snapshot.lastHandResult?.winners ?? [];
  }
}

export default DeuceToSevenTripleDrawController;
