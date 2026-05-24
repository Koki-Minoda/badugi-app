import { GameController } from "../core/GameController.js";
import {
  isSeatEligibleForBetting,
  isSeatEligibleForDrawing,
  normalizeTurnState,
} from "../core/turn/actorEligibility.js";
import { DeuceToSevenTripleDrawEngine } from "./DeuceToSevenTripleDrawEngine.js";
import { chooseProAction } from "../../ai/pro/proDecisionOverlay.js";

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

function normalizeSeatOut(source = {}, generated = {}) {
  return Boolean(
    source.seatOut ||
      source.sittingOut ||
      source.isBusted ||
      generated.seatOut ||
      generated.sittingOut,
  );
}

function hydratePlayersFromCurrentStacks(generatedPlayers = [], sourcePlayers = []) {
  if (!Array.isArray(sourcePlayers) || sourcePlayers.length === 0) {
    return generatedPlayers;
  }
  return generatedPlayers.map((player, seatIndex) => {
    const source = sourcePlayers[seatIndex] ?? null;
    if (!source) return player;
    const seatOut = normalizeSeatOut(source, player);
    const stackValue = Number(source.stack);
    const stack = seatOut
      ? 0
      : Number.isFinite(stackValue)
        ? Math.max(0, stackValue)
        : player.stack;
    return {
      ...player,
      id: source.id ?? player.id,
      playerId: source.playerId ?? source.id ?? player.playerId,
      name: source.name ?? player.name,
      avatar: source.avatar ?? player.avatar,
      avatarUrl: source.avatarUrl ?? player.avatarUrl,
      cpuCharacterId: source.cpuCharacterId ?? player.cpuCharacterId,
      cpuStyle: source.cpuStyle ?? player.cpuStyle,
      cpuModelId: source.cpuModelId ?? player.cpuModelId,
      trainingRun: source.trainingRun ?? player.trainingRun,
      titleBadge: source.titleBadge ?? player.titleBadge,
      stats: source.stats ?? player.stats,
      stack,
      bet: 0,
      totalInvested: 0,
      folded: seatOut || stack <= 0,
      allIn: false,
      sittingOut: seatOut,
      seatOut,
      isBusted: source.isBusted ?? player.isBusted,
      hasActedThisRound: false,
      hasDrawn: false,
      lastDrawCount: 0,
      lastAction: "",
    };
  });
}

function sumPots(pots = []) {
  return pots.reduce((sum, pot) => sum + Math.max(0, pot?.amount ?? 0), 0);
}

function sumStreetBets(players = []) {
  return players.reduce((sum, player) => sum + Math.max(0, Number(player?.bet) || 0), 0);
}

function normalizePhase(value) {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "DRAW") return "DRAW";
  if (normalized === "SHOWDOWN" || normalized === "HAND_RESULT") return "SHOWDOWN";
  return "BET";
}

function resolveExternalActor(snapshot = {}, metadata = {}) {
  const candidates = [
    snapshot.currentActor,
    snapshot.actingPlayerIndex,
    snapshot.turn,
    snapshot.nextTurn,
    metadata.actingPlayerIndex,
  ];
  for (const candidate of candidates) {
    if (Number.isInteger(candidate) && candidate >= 0) return candidate;
  }
  return null;
}

function normalizeExternalPlayer(player = {}, seatIndex = 0) {
  const hand = Array.isArray(player.hand)
    ? [...player.hand]
    : Array.isArray(player.cards)
      ? [...player.cards]
      : [];
  const seatOut = normalizeSeatOut(player);
  const folded = Boolean(player.folded || player.hasFolded || seatOut);
  const stack = Math.max(0, Number(player.stack ?? 0) || 0);
  const bet = Math.max(
    0,
    Number(player.bet ?? player.betThisRound ?? player.betThisStreet ?? 0) || 0,
  );
  const lastAction = player.lastAction ?? player.action ?? "";
  return {
    ...player,
    id: player.id ?? player.playerId ?? `seat-${seatIndex}`,
    playerId: player.playerId ?? player.id ?? `seat-${seatIndex}`,
    name: player.name ?? (seatIndex === 0 ? "You" : `CPU ${seatIndex + 1}`),
    seatIndex: player.seatIndex ?? seatIndex,
    seatType: player.seatType ?? (seatIndex === 0 ? "HUMAN" : "CPU"),
    isCPU:
      typeof player.isCPU === "boolean"
        ? player.isCPU
        : player.seatType
          ? player.seatType === "CPU"
          : seatIndex !== 0,
    hand,
    selected: Array.isArray(player.selected) ? [...player.selected] : [],
    stack,
    bet,
    totalInvested: Math.max(0, Number(player.totalInvested ?? bet) || 0),
    folded,
    allIn: Boolean(player.allIn || player.isAllIn),
    sittingOut: seatOut,
    seatOut,
    isBusted: Boolean(player.isBusted || player.busted),
    hasActedThisRound:
      typeof player.hasActedThisRound === "boolean"
        ? player.hasActedThisRound
        : ["CHECK", "CALL", "BET", "RAISE", "FOLD", "ALL-IN", "ALL_IN"].includes(
            String(lastAction).toUpperCase(),
          ),
    hasDrawn: Boolean(player.hasDrawn || player.hasDrawnThisRound),
    canDraw: player.canDraw,
    lastDrawCount: Number(player.lastDrawCount ?? 0) || 0,
    lastAction,
  };
}

function normalizeExternalPots(snapshot = {}, players = []) {
  const sourcePots = Array.isArray(snapshot.pots) ? snapshot.pots : [];
  if (sourcePots.length) {
    return sourcePots.map((pot) => {
      const amount = Math.max(0, Number(pot?.amount ?? pot?.pot ?? 0) || 0);
      const eligiblePlayerIds =
        pot?.eligiblePlayerIds ??
        pot?.eligible ??
        pot?.eligibleSeats?.map((seat) => players[seat]?.playerId ?? players[seat]?.id) ??
        [];
      return {
        ...pot,
        amount,
        eligiblePlayerIds: Array.isArray(eligiblePlayerIds) ? [...eligiblePlayerIds] : [],
      };
    });
  }
  const streetBets = sumStreetBets(players);
  const displayedPot = Math.max(0, Number(snapshot.pot ?? snapshot.potTotal ?? 0) || 0);
  if (streetBets > 0 || displayedPot <= 0) return [];
  return [
    {
      amount: displayedPot,
      eligiblePlayerIds: getActivePlayers(players).map((player) => player.playerId ?? player.id),
    },
  ];
}

function getSnapshotPot(state = {}, metadata = {}) {
  if (state?.isHandOver || metadata?.showdownSummary) {
    return Math.max(0, metadata.potAmount ?? sumPots(state?.pots ?? []));
  }
  return Math.max(0, (metadata.potAmount ?? sumPots(state?.pots ?? [])) + sumStreetBets(state?.players ?? []));
}

const COMPONENT_LABELS = {
  badugi: "Badugi half",
  low27: "2-7 Low half",
  lowA5: "A-5 Low half",
  archieHigh: "High half",
  archieLow: "A-5 Low half",
};

function getComponentLabel(component) {
  return COMPONENT_LABELS[component] ?? component;
}

function buildHandResultSummary({ showdownSummary = [], totalPot = 0, handId = null } = {}) {
  const potDetails = (Array.isArray(showdownSummary) ? showdownSummary : []).map((pot, potIndex) => {
    const componentLabel = pot.componentLabel ?? getComponentLabel(pot.component);
    const winners = (Array.isArray(pot?.payouts) ? pot.payouts : []).map((winner) => ({
      seatIndex: winner.seatIndex,
      name: winner.name,
      payout: winner.payout ?? 0,
      stack: winner.stackAfter,
      handLabel: winner.handName ?? winner.handLabel ?? "Low",
      ranksLabel: winner.ranksLabel ?? "",
      hand: Array.isArray(winner.hand) ? [...winner.hand] : [],
      activeCards: Array.isArray(winner.activeCards) ? [...winner.activeCards] : [],
      deadCards: Array.isArray(winner.deadCards) ? [...winner.deadCards] : [],
      component: winner.component ?? pot.component,
      componentLabel: winner.componentLabel ?? componentLabel,
    }));
    return {
      potIndex: pot.potIndex ?? potIndex,
      sourcePotIndex: pot.sourcePotIndex ?? pot.potIndex ?? potIndex,
      component: pot.component,
      componentLabel,
      label: pot.label ?? componentLabel,
      oddChipAmount: pot.oddChipAmount ?? 0,
      oddChip: pot.oddChip ?? null,
      eligibleSeatIndexes: Array.isArray(pot.eligibleSeatIndexes) ? [...pot.eligibleSeatIndexes] : [],
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
  const normalizedDiscardIndexes = Array.isArray(payload.discardIndexes)
    ? [...payload.discardIndexes]
    : Array.isArray(payload.drawIndexes)
      ? [...payload.drawIndexes]
      : Array.isArray(action.discardIndexes)
        ? [...action.discardIndexes]
        : undefined;
  return {
    ...payload,
    ...action,
    type,
    discardIndexes: normalizedDiscardIndexes,
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
  if (!player || player.folded || player.sittingOut || player.seatOut) {
    return [];
  }
  if (state.actingPlayerIndex !== null && state.actingPlayerIndex !== seatIndex) {
    return [];
  }
  if (state.street === "DRAW") {
    return isSeatEligibleForDrawing(player, state, { allowAllInDraw: true })
      ? [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }]
      : [];
  }
  if (!isSeatEligibleForBetting(player, { ...state, phase: "BET" })) {
    return [];
  }
  if (state.street !== "BET") return [];
  const currentBet = Math.max(
    state.metadata?.currentBet ?? 0,
    ...state.players.map((entry) => entry?.bet ?? 0),
  );
  const playerBet = player.bet ?? 0;
  const actions = [{ type: "FOLD" }];
  actions.push(playerBet >= currentBet ? { type: "CHECK" } : { type: "CALL" });
  const raiseCount = Math.max(0, Number(state.metadata?.raiseCountThisRound) || 0);
  const raiseCap = Math.max(1, Number(state.metadata?.raiseCap) || 4);
  if ((player.stack ?? 0) > 0 && raiseCount < raiseCap) {
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

  get variantId() {
    return this.engine?.variantId ?? "D01";
  }

  get gameId() {
    return this.engine?.id ?? "deuce_to_seven_triple_draw";
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
    const handId = options.handId ?? `${String(this.variantId).toLowerCase()}-hand-${this._handCounter}`;
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
    raw.players = hydratePlayersFromCurrentStacks(
      raw.players,
      options.currentPlayers ?? options.prevPlayers ?? prevState?.snapshot?.players ?? [],
    );
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

  syncFromExternalState({ snapshot = {}, context = null, handIndex = null } = {}) {
    const metadata = { ...(snapshot.metadata ?? {}) };
    const players = Array.isArray(snapshot.players)
      ? snapshot.players.map(normalizeExternalPlayer)
      : [];
    const street = normalizePhase(snapshot.phase ?? snapshot.street ?? metadata.phase);
    const actingPlayerIndex = resolveExternalActor(snapshot, metadata);
    const dealerIndex = Math.max(
      0,
      Number(
        snapshot.dealerIndex ??
          snapshot.dealerIdx ??
          snapshot.dealerSeat ??
          metadata.dealerIndex ??
          metadata.dealerIdx ??
          this.config.dealerIndex ??
          0,
      ) || 0,
    );
    const drawRoundIndex = Math.max(
      0,
      Number(snapshot.drawRoundIndex ?? snapshot.drawRound ?? metadata.drawRoundIndex ?? metadata.drawRound ?? 0) || 0,
    );
    const currentBet = Math.max(
      0,
      Number(snapshot.currentBet ?? metadata.currentBet ?? 0) || 0,
      ...players.map((player) => Number(player.bet ?? 0) || 0),
    );
    const engineState = {
      handId: snapshot.handId ?? this._lastState?.engineState?.handId ?? `external-${Date.now()}`,
      gameId: snapshot.gameId ?? this.gameId,
      engineId: snapshot.engineId ?? snapshot.gameId ?? this.gameId,
      players,
      dealerIndex,
      smallBlind: Number(snapshot.smallBlind ?? metadata.smallBlind ?? this.config.structure?.sb ?? DEFAULT_STRUCTURE.sb) || 0,
      bigBlind: Number(snapshot.bigBlind ?? metadata.bigBlind ?? this.config.structure?.bb ?? DEFAULT_STRUCTURE.bb) || 0,
      ante: Number(snapshot.ante ?? metadata.ante ?? this.config.structure?.ante ?? DEFAULT_STRUCTURE.ante) || 0,
      pots: normalizeExternalPots(snapshot, players),
      deck: Array.isArray(snapshot.deck) ? [...snapshot.deck] : [],
      street,
      drawRoundIndex,
      actingPlayerIndex,
      lastAggressorIndex:
        snapshot.lastAggressorIndex ??
        snapshot.lastAggressor ??
        metadata.lastAggressorIndex ??
        metadata.lastAggressor ??
        null,
      metadata: {
        ...metadata,
        variantId: metadata.variantId ?? snapshot.variantId ?? this.variantId,
        bettingStructure: metadata.bettingStructure ?? "fixed-limit",
        evaluator: metadata.evaluator ?? this.engine?.evaluatorTag,
        maxDrawRounds: metadata.maxDrawRounds ?? this.engine?.maxDrawRounds ?? 3,
        handCardCount: metadata.handCardCount ?? this.engine?.handCardCount ?? 5,
        currentBet,
        raiseCap: metadata.raiseCap ?? snapshot.raiseCap ?? 4,
        raiseCountThisRound:
          metadata.raiseCountThisRound ?? snapshot.raiseCountThisRound ?? 0,
        lastBlinds: metadata.lastBlinds ?? {
          sbIndex: snapshot.sbSeat ?? metadata.sbSeat ?? null,
          bbIndex: snapshot.bbSeat ?? metadata.bbSeat ?? null,
        },
      },
      isHandOver: Boolean(snapshot.isHandOver || street === "SHOWDOWN" || snapshot.lastHandResult),
    };
    const nextState = {
      handIndex:
        typeof handIndex === "number"
          ? handIndex
          : this._lastState?.handIndex ?? 0,
      engineState: cloneState(engineState),
      snapshot: this.getUiSnapshot(engineState),
      context,
      lastEvents: [{ type: "syncedExternalState", handId: engineState.handId }],
    };
    this._lastState = nextState;
    return nextState;
  }

  getUiSnapshot(state = null) {
    const source = state?.engineState ?? state ?? this._lastState?.engineState ?? null;
    if (!source) {
      return {
        gameId: this.gameId,
        variantId: this.variantId,
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
        maxDiscardCount: this.engine?.handCardCount ?? 5,
        handCardCount: this.engine?.handCardCount ?? 5,
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
    return normalizeTurnState({
      ...cloned,
      gameId: cloned.gameId,
      variantId: metadata.variantId ?? this.variantId,
      phase: cloned.street,
      street: cloned.street,
      drawRound: cloned.drawRoundIndex ?? 0,
      drawRoundIndex: cloned.drawRoundIndex ?? 0,
      players: cloned.players.map(toUiPlayer),
      pot: getSnapshotPot(cloned, metadata),
      pots: cloned.pots.map((pot) => ({ ...pot })),
      turn: cloned.actingPlayerIndex,
      nextTurn: cloned.actingPlayerIndex,
      actingPlayerIndex: cloned.actingPlayerIndex,
      currentBet: metadata.currentBet ?? 0,
      raiseStats: {
        raiseCountThisRound: Math.max(0, Number(metadata.raiseCountThisRound) || 0),
        raiseCap: Math.max(1, Number(metadata.raiseCap) || 4),
      },
      maxDiscardCount: this.engine?.handCardCount ?? metadata.handCardCount ?? 5,
      handCardCount: this.engine?.handCardCount ?? metadata.handCardCount ?? 5,
      lastHandResult,
      metadata,
    }, { phase: cloned.street, allowAllInDraw: true });
  }

  getLegalActions(state = {}, seatIndex) {
    const engineState = state?.engineState ?? this._lastState?.engineState ?? state;
    if (typeof seatIndex !== "number") return [];
    return deriveLegalActions(engineState ?? {}, seatIndex);
  }

  getCpuAction(state = {}, seatIndex = null, options = {}) {
    const engineState = state?.engineState ?? this._lastState?.engineState ?? state;
    const targetSeat = typeof seatIndex === "number" ? seatIndex : engineState?.actingPlayerIndex;
    const player = engineState?.players?.[targetSeat];
    if (!player?.isCPU) return null;
    const standardAction = this.engine.chooseCpuAction(engineState, targetSeat);
    if (options?.tierConfig?.id !== "pro") {
      return standardAction;
    }
    const legalActions = deriveLegalActions(engineState ?? {}, targetSeat);
    const result = chooseProAction({
      variantId: this.variantId,
      snapshot: {
        ...engineState,
        variantId: this.variantId,
        phase: engineState?.street,
        maxDiscardCount: this.engine?.handCardCount ?? 5,
        maxDrawRounds: this.engine?.maxDrawRounds ?? 3,
      },
      legalActions,
      standardAction,
      context: { actor: player },
    });
    if (!result?.type) {
      return standardAction;
    }
    return {
      seatIndex: targetSeat,
      type: result.type,
      discardIndexes: result.discardIndexes,
      amount: result.amount,
      metadata: {
        ...(standardAction?.metadata ?? {}),
        ...(result?.metadata ?? {}),
        strategy: `pro-${this.variantId.toLowerCase()}`,
        tierId: options?.tierConfig?.id ?? "pro",
        decisionSource: result.source,
        decisionReason: result.reason,
        confidence: result.confidence,
        warnings: result.warnings ?? [],
      },
    };
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
