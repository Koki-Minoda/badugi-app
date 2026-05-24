import { DrawEngineBase } from "../../core/drawEngineBase.js";
import { cloneTableState } from "../../core/models.js";
import { IllegalActionError, assertSeatIsActive } from "../../core/errors.js";
import {
  buildBadugiObservationPayload,
  buildBadugiObservationVector,
} from "../../../rl/badugiObservationSchema.js";
import { DeckManager } from "../utils/deck.js";
import { dealInitialHands, validatePreflopState } from "../utils/deckHelpers.js";
import { resolveBadugiWinners } from "./badugiComparison.js";
import { createBadugiTableState } from "./legacyState.js";
import {
  settleStreetToPots,
  calcDrawStartIndex,
  nextAliveFrom,
} from "./roundFlow.jsx";
import {
  isSeatEligibleForBet,
  isSeatEligibleForDraw,
  markPlayerFolded,
  findNextDrawActorSeat,
  resolveOpeningBetActor,
  getBlindSeatsForPlayers,
} from "../flow/actionUtils.js";
import { applyChips } from "../flow/actionUtils.js";
import { normalizePotsWithContributions } from "./potIntegrity.js";
import { getFixedLimitBetSize, getFixedLimitRaiseCap } from "../logic/bettingRules.js";
import { normalizeBetActionAmount } from "../logic/actionAmount.js";

const SUPPORTED_ACTIONS = new Set(["FOLD", "CHECK", "CALL", "RAISE", "DRAW", "SHOW"]);

/**
 * BadugiEngine is a thin wrapper around the legacy Badugi logic. It currently
 * initializes table state and validates actions while the existing roundFlow
 * module drives betting/draw phases. Future Spec09 work will migrate more
 * behavior here.
 */
export class BadugiEngine extends DrawEngineBase {
  constructor() {
    super({ gameId: "badugi", displayName: "Badugi", maxDrawRounds: 3 });
    this.deckManager = new DeckManager();
  }

  initHand(ctx = {}) {
    const deckManager = this.getDeckManager();
    deckManager.reset();
    if (typeof deckManager.shuffle === "function") {
      deckManager.shuffle();
    }
    if (typeof deckManager.burnTopCards === "function") {
      deckManager.burnTopCards(1);
    }
    const state = createBadugiTableState(ctx);
    const seatsForDeal = (state.players ?? []).map((player, seatIndex) => ({
      seatIndex,
      seatOut: Boolean(player?.seatOut),
      seatType: player?.seatType,
    }));
    const dealerIdx = ctx?.dealerIndex ?? state.dealerIndex ?? 0;
    const dealResult = dealInitialHands({
      deckManager,
      seats: seatsForDeal,
      dealerIdx,
      cardsPerPlayer: 4,
    });
    state.players = (state.players ?? []).map((player, idx) => ({
      ...player,
      hand: dealResult?.hands?.[idx] ?? [],
    }));
    const preflopCheck = validatePreflopState({
      deck: deckManager.deck,
      burn: deckManager.burnPile,
      discard: deckManager.discardPile,
      players: state.players,
    });
    if (
      !preflopCheck.isValidTotal ||
      !preflopCheck.hasSingleBurn ||
      !preflopCheck.hasEmptyDiscard
    ) {
      console.error("[DECK][PRE_FLOP_INVALID]", preflopCheck);
      throw new Error("Badugi deck integrity violated (engine)");
    }
    if (preflopCheck.total !== 52) {
      console.error("[DECK][INTEGRITY_FAIL][ENGINE]", {
        deck: deckManager.deck,
        discard: deckManager.discardPile,
        burn: deckManager.burnPile,
        total: preflopCheck.total,
        players: state.players?.map((p) => p?.hand ?? []),
      });
      throw new Error("Badugi deck integrity violated (engine-total)");
    }
    return state;
  }

  applyForcedBets(state) {
    if (!state) {
      throw new IllegalActionError("Table state is required for forced bets");
    }
    const next = cloneTableState(state);
    const players = next.players ?? [];
    if (players.length === 0) return next;

    const ante = Math.max(0, next.ante ?? 0);
    if (ante > 0) {
      for (let i = 0; i < players.length; i += 1) {
        const p = players[i];
        if (!isSeatEligible(p)) continue;
        const { updated, paid } = payContribution(p, ante);
        if (paid > 0) {
          players[i] = updated;
        }
      }
    }

    const { sbIdx, bbIdx } = getBlindSeatsForPlayers(players, next.dealerIndex);
    const sbIndex = typeof sbIdx === "number" ? sbIdx : -1;
    const bbIndex = typeof bbIdx === "number" ? bbIdx : -1;

    let sbPay = 0;
    let bbPay = 0;

    if (sbIndex !== -1 && next.smallBlind > 0) {
      const { updated, paid } = payContribution(players[sbIndex], next.smallBlind);
      sbPay = paid;
      players[sbIndex] = updated;
    }

    if (bbIndex !== -1 && next.bigBlind > 0) {
      const { updated, paid } = payContribution(players[bbIndex], next.bigBlind);
      bbPay = paid;
      players[bbIndex] = updated;
    }

    players.forEach((player) => {
      if (isSeatEligibleForBet(player)) {
        player.hasActedThisRound = false;
      }
    });

    const actingPlayerIndex = resolveOpeningBetActor({
      seats: players,
      buttonSeat: next.dealerIndex,
      smallBlindSeat: sbIndex !== -1 ? sbIndex : null,
      bigBlindSeat: bbIndex !== -1 ? bbIndex : null,
      phase: "BET",
      round: 1,
    });

    next.players = players;
    next.lastAggressorIndex = bbIndex !== -1 ? bbIndex : sbIndex !== -1 ? sbIndex : next.dealerIndex;
    next.actingPlayerIndex = typeof actingPlayerIndex === "number" ? actingPlayerIndex : null;
    next.turn = next.actingPlayerIndex;
    next.nextTurn = next.actingPlayerIndex;
    const committed = sumCommitted(players);
    next.metadata = {
      ...(next.metadata ?? {}),
      forcedBetsApplied: true,
      lastBlinds: { sbIndex, sbPay, bbIndex, bbPay },
      currentBet: computeCurrentBet(players),
      betHead: next.actingPlayerIndex,
      actingPlayerIndex: next.actingPlayerIndex,
      raiseCountThisRound: 0,
      raiseCap: getFixedLimitRaiseCap(next?.metadata?.raiseCap),
      totalCommitted: committed,
      potAmount: committed + sumPotAmounts(next.pots),
    };

    return next;
  }

  getDeckManager() {
    if (!this.deckManager) {
      this.deckManager = new DeckManager();
    }
    return this.deckManager;
  }

  applyPlayerAction(state, action = {}) {
    if (!state) {
      throw new IllegalActionError("Table state is required");
    }
    const { seatIndex, type } = action;
    const normalizedType = typeof type === "string" ? type.toUpperCase() : null;
    if (!SUPPORTED_ACTIONS.has(normalizedType)) {
      throw new IllegalActionError("Unsupported action type", { seatIndex, actionType: type });
    }
    if (typeof seatIndex !== "number" || seatIndex < 0 || seatIndex >= (state.players?.length ?? 0)) {
      throw new IllegalActionError("seatIndex is required", { seatIndex, actionType: type });
    }
    const player = state.players?.[seatIndex];
    assertSeatIsActive(player, { seatIndex, actionType: normalizedType });

    const next = cloneTableState(state);
    next.players = (next.players ?? []).map((p) => ({ ...p }));
    const target = next.players[seatIndex];

    if (!target) {
      throw new IllegalActionError("Seat not found", { seatIndex, actionType: type });
    }

    const metadata = {
      ...(action.metadata ?? {}),
    };
    const tableMeta = ensureMetadata(next);
    if (typeof next.bigBlind === "number") {
      tableMeta.bbValue = next.bigBlind;
    }
    tableMeta.drawRoundIndex = next.drawRoundIndex ?? tableMeta.drawRoundIndex ?? 0;
    tableMeta.betRoundIndex = next.betRoundIndex ?? tableMeta.betRoundIndex ?? 0;
    tableMeta.raiseCap = resolveRaiseCap(next);

    const validation = validateAction(next, seatIndex, {
      type: normalizedType,
      amount: metadata.amount,
    });
    if (!validation.isValid) {
      throw new IllegalActionError(validation.message ?? "Invalid action", {
        seatIndex,
        actionType: normalizedType,
        ...(validation.context ?? {}),
      });
    }
    metadata.toCall = validation.toCall;
    metadata.unit = validation.unit;
    metadata.normalizedContribution = validation.expectedContribution;
    metadata.raiseIncrement = validation.raiseIncrement;
    metadata.amountSchema = validation.amountSchema;

    switch (normalizedType) {
      case "FOLD":
        applyFoldState(next, seatIndex, metadata);
        break;
      case "CALL":
        applyCallState(next, seatIndex, metadata);
        break;
      case "CHECK":
        applyCheckState(next, seatIndex, metadata);
        break;
      case "RAISE":
        applyRaiseState(next, seatIndex, metadata);
        break;
      case "DRAW":
        applyDrawState(target, metadata);
        break;
      default:
        target.lastAction = normalizedType;
        break;
    }

    updateActingSeat(next, seatIndex, metadata);
    const meta = ensureMetadata(next);
    meta.lastAction = {
      seatIndex,
      type: normalizedType,
      timestamp: Date.now(),
      ...(metadata ?? {}),
    };
    updateBettingMetadata(next, seatIndex, normalizedType, metadata);

    return next;
  }

  advanceAfterBet(
    state,
    {
      drawRound = 0,
      maxDraws = this.maxDrawRounds ?? 3,
      dealerIndex = state?.dealerIndex ?? 0,
      numPlayers = state?.players?.length ?? 0,
    } = {}
  ) {
    if (!state) {
      throw new IllegalActionError("Table state is required");
    }
    const working = cloneTableState(state);
    const { pots, clearedPlayers } = settleStreetToPots(working.players ?? [], working.pots ?? []);
    working.players = clearedPlayers;
    working.pots = pots;
    working.metadata = {
      ...(working.metadata ?? {}),
      lastStreet: "BET",
      totalCommitted: 0,
      potAmount: sumPotAmounts(pots),
      currentBet: 0,
      raiseCountThisRound: 0,
      raiseCap: getFixedLimitRaiseCap(working?.metadata?.raiseCap),
      betRoundIndex: drawRound,
      drawRoundIndex: drawRound,
    };
    working.betRoundIndex = drawRound;

    const nextRound = drawRound + 1;
    if (nextRound > maxDraws) {
      return transitionEngineToShowdown(this, working, dealerIndex, drawRound);
    }

    transitionEngineToDrawState(working, {
      dealerIndex,
      nextRound,
      numPlayers: numPlayers || working.players.length || 6,
    });

    return {
      state: working,
      street: "DRAW",
      drawRoundIndex: nextRound,
      actingPlayerIndex: working.actingPlayerIndex,
      players: working.players,
      pots: working.pots,
    };
  }

  getObservation(state, playerId) {
    const base = super.getObservation(state, playerId);
    const potTotal = (state.pots ?? []).reduce((sum, pot) => sum + (pot.amount ?? 0), 0);
    const seatIndex = (state.players ?? []).findIndex(
      (player) =>
        player?.id === playerId ||
        player?.playerId === playerId ||
        player?.tournamentPlayerId === playerId,
    );
    const observation = buildBadugiObservationPayload({
      state,
      seatIndex: seatIndex >= 0 ? seatIndex : null,
      playerId,
    });
    return {
      ...base,
      schemaVersion: observation.schemaVersion,
      observation,
      stateVector: buildBadugiObservationVector(observation),
      info: {
        street: state.street,
        drawRoundIndex: state.drawRoundIndex ?? 0,
        actingPlayerIndex: state.actingPlayerIndex ?? null,
        potTotal,
        playerId,
      },
    };
  }

  resolveShowdown(state, { cloneState = true } = {}) {
    if (!state) {
      throw new IllegalActionError("Table state is required for showdown");
    }
    const working = cloneState ? cloneTableState(state) : state;
    const players = working.players ?? [];
    const { pots, totalPot: reconciledPotTotal } = normalizePotsWithContributions(
      players,
      working.pots ?? []
    );
    const summary = [];
    let totalPot = reconciledPotTotal;

    pots.forEach((pot, potIndex) => {
      const amount = Math.max(0, pot?.amount ?? 0);
      if (amount <= 0) {
        summary.push({
          potIndex,
          potAmount: 0,
          payouts: [],
        });
        return;
      }

      const eligibleSeats = normalizeEligibleSeats(pot, players.length);
      const contenders = eligibleSeats
        .map((seatIndex) => {
          const player = players[seatIndex];
          if (
            !player ||
            player.folded ||
            player.seatOut ||
            player.isActiveInGame === false
          )
            return null;
          return {
            seatIndex,
            name: player.name,
            hand: extractHand(player),
          };
        })
        .filter(Boolean);

      if (contenders.length === 0) {
        summary.push({
          potIndex,
          potAmount: amount,
          payouts: [],
        });
        return;
      }

      const winners = resolveBadugiWinners(contenders);
      if (!winners.length) {
        summary.push({
          potIndex,
          potAmount: amount,
          payouts: [],
        });
        return;
      }

      const baseShare = Math.floor(amount / winners.length);
      let remainder = amount % winners.length;
      const payouts = [];

      winners.forEach((winner) => {
        const idx = typeof winner.seat === "number" ? winner.seat : winner.seatIndex;
        if (typeof idx !== "number" || !players[idx]) return;
        const stackBefore = players[idx].stack ?? 0;
        const payout = baseShare + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
        players[idx].stack = Math.max(0, stackBefore + payout);
        players[idx].betThisRound = 0;
        players[idx].hasActedThisRound = false;
        players[idx].lastAction = `Collect ${payout}`;
        if (players[idx].stack === 0) {
          players[idx].allIn = true;
        } else {
          players[idx].allIn = false;
        }
        payouts.push({
          seatIndex: idx,
          name: players[idx].name,
          payout,
          stackBefore,
          stackAfter: players[idx].stack,
        });
      });

      summary.push({
        potIndex,
        potAmount: amount,
        payouts,
      });
    });

    working.pots = [];
    working.players = players.map((player) => ({
      ...player,
      betThisRound: 0,
      isBusted: player.stack <= 0,
    }));
    working.metadata = {
      ...(working.metadata ?? {}),
      currentBet: 0,
      betHead: null,
      totalCommitted: 0,
      potAmount: 0,
      showdownSummary: summary,
      showdownTotal: totalPot,
    };

    return {
      state: working,
      summary,
      totalPot,
    };
  }
}

function isSeatEligible(player) {
  if (!player) return false;
  return !player.seatOut && !player.isBusted;
}

function payContribution(player, amount) {
  if (!player || amount <= 0) return { updated: player, paid: 0 };
  const updated = { ...player };
  const pay = applyChips(updated, amount);
  if (pay <= 0) return { updated, paid: 0 };
  updated.betThisRound = (updated.betThisRound ?? 0) + pay;

  if (updated.stack === 0) {
    updated.allIn = true;
    updated.hasActedThisRound = true;
  } else {
    updated.hasActedThisRound = false;
  }

  return { updated, paid: pay };
}

function computeCurrentBet(players) {
  if (!Array.isArray(players)) return 0;
  return players.reduce((max, p) => Math.max(max, p?.betThisRound ?? 0), 0);
}

function computeToCall(table, seatIndex) {
  if (!table || !Array.isArray(table.players)) return 0;
  const player = table.players[seatIndex];
  if (!player) return 0;
  const currentBet = computeCurrentBet(table.players);
  return Math.max(0, currentBet - (player.betThisRound ?? 0));
}

function resolveRaiseSize(table) {
  const baseBet =
    Number(table?.bigBlind) ||
    Number(table?.metadata?.bbValue) ||
    Number(table?.metadata?.bigBlind) ||
    (Number(table?.smallBlind) || 0) * 2;
  if (baseBet > 0) {
    return getFixedLimitBetSize({
      baseBet,
      drawRound: table?.drawRoundIndex ?? table?.metadata?.drawRoundIndex ?? 0,
      betRound: table?.betRoundIndex ?? table?.metadata?.betRoundIndex ?? 0,
    });
  }
  const currentBet = Array.isArray(table?.players) ? computeCurrentBet(table.players) : 0;
  return Math.max(1, currentBet || 1);
}

function resolveFixedLimitUnit(table) {
  return Math.max(1, Math.trunc(resolveRaiseSize(table)));
}

function resolveRaiseCount(table) {
  return Math.max(0, Math.trunc(table?.metadata?.raiseCountThisRound ?? 0));
}

function resolveRaiseCap(table) {
  const candidates = [
    table?.metadata?.raiseCap,
    table?.raiseCap,
    table?.level?.raiseCap,
    table?.config?.raiseCap,
  ];
  for (const value of candidates) {
    const normalized = getFixedLimitRaiseCap(value);
    if (typeof normalized === "number") {
      return normalized;
    }
  }
  return null;
}

function resolveValidatedAmount({ type, amount, toCall, unit }) {
  return normalizeBetActionAmount({
    actionType: type,
    amount,
    toCall,
    unit,
  });
}

export function validateAction(table, seatIndex, actionPayload = {}) {
  const normalizedType = String(actionPayload?.type ?? "").toUpperCase();
  const player = table?.players?.[seatIndex];
  if (!player) {
    return {
      isValid: false,
      code: "SEAT_NOT_FOUND",
      message: "Seat not found",
      context: { seatIndex, actionType: normalizedType },
    };
  }

  const toCall = computeToCall(table, seatIndex);
  const unit = resolveFixedLimitUnit(table);
  const raiseCount = resolveRaiseCount(table);
  const raiseCap = resolveRaiseCap(table);
  const stack = Math.max(0, Number(player?.stack) || 0);
  const normalizedAmount = resolveValidatedAmount({
    type: normalizedType,
    amount: actionPayload?.amount,
    toCall,
    unit,
  });

  if (normalizedType === "CHECK" && toCall > 0) {
    return {
      isValid: false,
      code: "FL_CHECK_TO_CALL",
      message: "Check is only legal when to-call is zero",
      context: { seatIndex, toCall },
    };
  }

  if (normalizedType === "CALL" && !normalizedAmount.isValid && stack >= toCall) {
    return {
      isValid: false,
      code: normalizedAmount.code ?? "FL_CALL_MISMATCH",
      message: normalizedAmount.message,
      context: {
        seatIndex,
        toCall,
        requestedAmount: normalizedAmount.requestedAmount,
      },
    };
  }

  if (normalizedType === "RAISE") {
    if (typeof raiseCap === "number" && raiseCount >= raiseCap) {
      return {
        isValid: false,
        code: "FL_RAISE_CAP",
        message: "Raise cap reached for this betting round",
        context: { seatIndex, raiseCount, raiseCap },
      };
    }
    if (!normalizedAmount.isValid && stack >= toCall + unit) {
      return {
        isValid: false,
        code: normalizedAmount.code ?? "FL_RAISE_AMOUNT",
        message: normalizedAmount.message,
        context: {
          seatIndex,
          toCall,
          unit,
          requestedAmount: normalizedAmount.requestedAmount,
          expectedAmount: normalizedAmount.expectedContribution,
        },
      };
    }
    if (normalizedAmount.isValid && normalizedAmount.raiseIncrement !== unit) {
      return {
        isValid: false,
        code: "FL_RAISE_UNIT",
        message: "Raise increment must equal fixed-limit unit",
        context: {
          seatIndex,
          raiseIncrement: normalizedAmount.raiseIncrement,
          unit,
        },
      };
    }
  }

  return {
    isValid: true,
    toCall,
    unit,
    raiseCount,
    raiseCap,
    expectedContribution:
      normalizedType === "CALL"
        ? toCall
        : normalizedType === "RAISE" || normalizedType === "BET"
        ? toCall + unit
        : Math.max(0, normalizedAmount.contribution ?? 0),
    raiseIncrement: Math.max(0, normalizedAmount.raiseIncrement ?? 0),
    amountSchema: normalizedAmount.schema ?? "none",
  };
}

/**
 * ENGINE-LEGACY: DRAW actor helper for engine-managed tables only.
 * FLOW/UI must rely on flow/nextActorUtils instead of invoking this directly.
 */
function findDrawableSeat(players = [], startIndex = 0) {
  if (!Array.isArray(players) || players.length === 0) return 0;
  const seat = findNextDrawActorSeat(players, startIndex);
  if (typeof seat === "number") return seat;
  return ((startIndex % players.length) + players.length) % players.length;
}

function applyDrawState(target, metadata = {}) {
  const drawCount =
    metadata.drawCount ??
    (Array.isArray(metadata.replacedCards) ? metadata.replacedCards.length : 0) ??
    0;
  const handAfter = Array.isArray(metadata.handAfter)
    ? [...metadata.handAfter]
    : Array.isArray(target.hand)
    ? [...target.hand]
    : [];
  target.hand = handAfter;
  target.hasDrawn = true;
  target.hasActedThisRound = true;
  target.lastDrawCount = drawCount;
  target.lastAction = metadata.actionLabel ?? (drawCount > 0 ? `DRAW(${drawCount})` : "Pat");
}

function transitionEngineToDrawState(table, { dealerIndex = 0, nextRound = 0, numPlayers = 6 } = {}) {
  const players = table.players ?? [];
  const drawStartBase = calcDrawStartIndex(
    dealerIndex,
    nextRound,
    numPlayers || players.length || 6,
  );
  const firstToDraw = findDrawableSeat(players, drawStartBase);
  const resetPlayers = players.map((p) => {
    // All-in players are done with BET actions, but in draw poker they still
    // receive their draw decision while live in the hand.
    const out = !isSeatEligibleForDraw(p);
    return {
      ...p,
      hasDrawn: out ? true : false,
      canDraw: !out,
      hasActedThisRound: out ? true : false,
      lastAction: out ? p?.lastAction || "Fold" : p?.lastAction ?? "",
    };
  });
  table.players = resetPlayers;
  table.drawRoundIndex = nextRound;
  table.street = "DRAW";
  table.actingPlayerIndex = firstToDraw;
}

function transitionEngineToShowdown(engine, table, dealerIndex, drawRound) {
  table.street = "SHOWDOWN";
  table.isHandOver = true;
  table.actingPlayerIndex = dealerIndex;
  const showdownResult = engine.resolveShowdown(table, { cloneState: false });
  return {
    state: showdownResult?.state ?? table,
    street: "SHOWDOWN",
    drawRoundIndex: drawRound,
    showdown: true,
    players: showdownResult?.state?.players ?? table.players,
    pots: showdownResult?.state?.pots ?? table.pots,
    showdownSummary: showdownResult?.summary,
    totalPot: showdownResult?.totalPot,
  };
}

function applyFoldState(table, seatIndex, metadata = {}) {
  const player = table.players?.[seatIndex];
  if (!player) return;
  const workingMeta = { ...(metadata ?? {}) };
  const stackBefore = player.stack ?? 0;
  const betBefore = player.betThisRound ?? 0;
  if (typeof workingMeta.stackBefore !== "number") workingMeta.stackBefore = stackBefore;
  if (typeof workingMeta.betBefore !== "number") workingMeta.betBefore = betBefore;
  if (typeof workingMeta.stackAfter !== "number") workingMeta.stackAfter = stackBefore;
  if (typeof workingMeta.betAfter !== "number") workingMeta.betAfter = betBefore;
  player.stack = workingMeta.stackAfter;
  player.betThisRound = workingMeta.betAfter;
  markPlayerFolded(player);
  player.lastAction = workingMeta.actionLabel ?? "Fold";
  const nextSeat = nextAliveFrom(table.players, seatIndex);
  const meta = (table.metadata = { ...(table.metadata ?? {}) });
  if (table.lastAggressorIndex === seatIndex) {
    table.lastAggressorIndex = typeof nextSeat === "number" ? nextSeat : null;
  }
  if (meta.betHead === seatIndex || typeof meta.betHead !== "number") {
    meta.betHead = typeof nextSeat === "number" ? nextSeat : null;
  }
  meta.currentBet = computeCurrentBet(table.players);
}

function applyCallState(table, seatIndex, metadata = {}) {
  const player = table.players?.[seatIndex];
  if (!player) return;
  const workingMeta = { ...(metadata ?? {}) };
  const stackBefore = player.stack ?? 0;
  const betBefore = player.betThisRound ?? 0;
  const toCall = Number.isFinite(workingMeta.toCall)
    ? Math.max(0, Number(workingMeta.toCall) || 0)
    : computeToCall(table, seatIndex);
  if (typeof workingMeta.stackBefore !== "number") workingMeta.stackBefore = stackBefore;
  if (typeof workingMeta.betBefore !== "number") workingMeta.betBefore = betBefore;
  if (typeof workingMeta.stackAfter !== "number" || typeof workingMeta.betAfter !== "number") {
    const pay = Math.min(stackBefore, toCall);
    workingMeta.toCall = typeof workingMeta.toCall === "number" ? workingMeta.toCall : toCall;
    workingMeta.paid = typeof workingMeta.paid === "number" ? workingMeta.paid : pay;
    workingMeta.betAfter = betBefore + workingMeta.paid;
    workingMeta.stackAfter = Math.max(0, stackBefore - workingMeta.paid);
  }
  applyStackAndBetSync(player, workingMeta, table);
  player.hasActedThisRound = true;
  const toCallValue = workingMeta.toCall ?? 0;
  const paidValue = workingMeta.paid ?? 0;
  if (typeof workingMeta.actionLabel === "string") {
    player.lastAction = workingMeta.actionLabel;
  } else if (paidValue > 0) {
    if (toCallValue > 0 && paidValue < toCallValue) {
      player.lastAction = "Call (All-in)";
    } else {
      player.lastAction = "Call";
    }
  } else if (toCallValue > 0) {
    player.lastAction = "Call";
  } else {
    player.lastAction = "Check";
  }
  const meta = (table.metadata = { ...(table.metadata ?? {}) });
  meta.currentBet = computeCurrentBet(table.players);
}

function applyCheckState(table, seatIndex, metadata = {}) {
  const player = table.players?.[seatIndex];
  if (!player) return;
  player.hasActedThisRound = true;
  player.lastAction = metadata.actionLabel ?? "Check";
}

function applyRaiseState(table, seatIndex, metadata = {}) {
  const player = table.players?.[seatIndex];
  if (!player) return;
  const workingMeta = { ...(metadata ?? {}) };
  const stackBefore = player.stack ?? 0;
  const betBefore = player.betThisRound ?? 0;
  const toCall = Number.isFinite(workingMeta.toCall)
    ? Math.max(0, Number(workingMeta.toCall) || 0)
    : computeToCall(table, seatIndex);
  const unit = Number.isFinite(workingMeta.unit)
    ? Math.max(1, Math.trunc(Number(workingMeta.unit) || 1))
    : resolveFixedLimitUnit(table);
  const expectedContribution = Number.isFinite(workingMeta.normalizedContribution)
    ? Math.max(0, Number(workingMeta.normalizedContribution) || 0)
    : toCall + unit;
  if (typeof workingMeta.stackBefore !== "number") workingMeta.stackBefore = stackBefore;
  if (typeof workingMeta.betBefore !== "number") workingMeta.betBefore = betBefore;
  if (typeof workingMeta.stackAfter !== "number" || typeof workingMeta.betAfter !== "number") {
    const pay = Math.min(stackBefore, expectedContribution);
    workingMeta.toCall = typeof workingMeta.toCall === "number" ? workingMeta.toCall : toCall;
    workingMeta.raise = typeof workingMeta.raise === "number" ? workingMeta.raise : unit;
    workingMeta.paid = typeof workingMeta.paid === "number" ? workingMeta.paid : pay;
    workingMeta.betAfter = betBefore + workingMeta.paid;
    workingMeta.stackAfter = Math.max(0, stackBefore - workingMeta.paid);
  }
  const syncResult = applyStackAndBetSync(player, workingMeta, table);
  const currentBetBefore = computeCurrentBet(
    (table.players ?? []).map((entry, index) =>
      index === seatIndex
        ? { ...entry, betThisRound: betBefore, stack: stackBefore }
        : entry,
    ),
  );
  const fullRaiseBet = currentBetBefore + unit;
  const reopenedAction = Number(syncResult?.betAfter ?? 0) >= fullRaiseBet;
  workingMeta.reopenedAction = reopenedAction;
  metadata.reopenedAction = reopenedAction;
  player.hasActedThisRound = true;
  player.lastAction =
    workingMeta.actionLabel ??
    (reopenedAction
      ? "Raise"
      : currentBetBefore === 0 && Number(syncResult?.contribution ?? 0) > 0
      ? "All-in"
      : Number(syncResult?.contribution ?? 0) > 0
      ? "Call"
      : "Check");
  metadata.actionLabel = player.lastAction;
  if (reopenedAction) {
    for (let i = 0; i < (table.players?.length ?? 0); i += 1) {
      if (i === seatIndex) continue;
      const other = table.players[i];
      if (!other || !isSeatEligibleForBet(other) || other.allIn) continue;
      other.hasActedThisRound = false;
    }
  }
  const meta = (table.metadata = { ...(table.metadata ?? {}) });
  meta.currentBet = computeCurrentBet(table.players);
  if (reopenedAction) {
    meta.betHead = seatIndex;
    table.lastAggressorIndex = seatIndex;
  }
}

function ensureMetadata(table) {
  if (!table.metadata) {
    table.metadata = {};
  }
  return table.metadata;
}

function updateActingSeat(table, seatIndex, metadata = {}) {
  if (!Array.isArray(table.players) || table.players.length === 0) return null;
  if (typeof metadata.nextActingIndex === "number") {
    table.actingPlayerIndex = metadata.nextActingIndex;
    return metadata.nextActingIndex;
  }
  const nextSeat = findNextBetActor(table, seatIndex);
  if (typeof nextSeat === "number") {
    table.actingPlayerIndex = nextSeat;
    return nextSeat;
  }
  forceFinishCurrentRound(table);
  return table.actingPlayerIndex ?? null;
}

/**
 * ENGINE-LEGACY: next BET actor search limited to BadugiEngine state.
 * FLOW/UI must NOT import this helper; use flow/nextActorUtils instead.
 */
function findNextBetActor(table, currentSeat) {
  const players = table?.players ?? [];
  const n = players.length;
  if (!n || typeof currentSeat !== "number" || currentSeat < 0 || currentSeat >= n) {
    return null;
  }
  let cursor = currentSeat;
  for (let step = 0; step < n; step += 1) {
    cursor = (cursor + 1) % n;
    const candidate = players[cursor];
    if (isSeatEligibleForBet(candidate) && !candidate.hasActedThisRound) {
      return cursor;
    }
  }
  return null;
}

function forceFinishCurrentRound(table) {
  if (!table || table.phase !== "BET") return null;
  // NOTE (H-01-3 / G-11c): After closing a BET round via this helper we
  // intentionally clear actingPlayerIndex/betHead. The next phase helper
  // (transitionToBetPhase/transitionToDrawPhase/transitionToShowdownPhase)
  // must elect a fresh acting seat; actingPlayerIndex is meaningless between
  // phases.
  table.actingPlayerIndex = null;
  const meta = ensureMetadata(table);
  meta.betHead = null;
  return null;
}

function updateBettingMetadata(table, seatIndex, actionType, metadata = {}) {
  const meta = ensureMetadata(table);
  meta.currentBet = computeCurrentBet(table.players);
  meta.totalCommitted = sumCommitted(table.players);
  meta.potAmount = sumPotAmounts(table.pots) + meta.totalCommitted;
  meta.raiseCap = resolveRaiseCap(table);
  if (typeof meta.raiseCountThisRound !== "number") {
    meta.raiseCountThisRound = 0;
  }

  if (actionType === "RAISE" && metadata?.reopenedAction !== false) {
    meta.betHead = seatIndex;
    meta.raiseCountThisRound += 1;
    table.lastAggressorIndex = seatIndex;
  } else if (actionType === "FOLD" && meta.betHead === seatIndex) {
    const nextSeat = nextAliveFrom(table.players, seatIndex);
    meta.betHead = typeof nextSeat === "number" ? nextSeat : null;
    if (table.lastAggressorIndex === seatIndex) {
      table.lastAggressorIndex = meta.betHead;
    }
  } else if (actionType !== "RAISE" && typeof meta.betHead !== "number") {
    meta.betHead = seatIndex;
  }

  if (metadata && typeof metadata.forceCurrentBet === "number") {
    meta.currentBet = metadata.forceCurrentBet;
  }
}

function sumCommitted(players = []) {
  return players.reduce((sum, p) => sum + (p?.betThisRound ?? 0), 0);
}

function sumPotAmounts(pots = []) {
  return pots.reduce((sum, pot) => sum + (pot?.amount ?? 0), 0);
}

function applyStackAndBetSync(player, metadata = {}, table = null) {
  const stackBefore =
    typeof metadata.stackBefore === "number" ? metadata.stackBefore : player.stack ?? 0;
  const betBefore =
    typeof metadata.betBefore === "number" ? metadata.betBefore : player.betThisRound ?? 0;

  let paid = typeof metadata.paid === "number" ? metadata.paid : undefined;
  if (typeof paid !== "number") {
    const target =
      typeof metadata.toCall === "number"
        ? metadata.toCall + Math.max(0, metadata.raise ?? 0)
        : Math.max(
            0,
            (table ? computeCurrentBet(table.players) : betBefore) - betBefore
          );
    paid = target;
  }
  const applied = applyChips(player, paid);
  player.betThisRound = betBefore + applied;
  const stackAfter = player.stack;
  const betAfter = player.betThisRound;
  const contribution = Math.max(0, betAfter - betBefore);

  player.hasActedThisRound = true;
  if (player.stack === 0) {
    player.allIn = true;
  }

  return {
    contribution,
    stackBefore,
    betBefore,
    stackAfter,
    betAfter,
  };
}

function normalizeEligibleSeats(pot, playerCount) {
  if (!pot) return [];
  if (Array.isArray(pot.eligible)) return pot.eligible;
  if (Array.isArray(pot.eligibleSeats)) return pot.eligibleSeats;
  if (Array.isArray(pot.eligiblePlayerIds)) {
    return pot.eligiblePlayerIds
      .map((id) => {
        if (typeof id === "number") return id;
        if (typeof id === "string" && id.startsWith("seat-")) {
          const parsed = Number(id.replace("seat-", ""));
          return Number.isNaN(parsed) ? null : parsed;
        }
        return null;
      })
      .filter((idx) => typeof idx === "number" && idx >= 0 && idx < playerCount);
  }
  return Array.from({ length: playerCount }, (_, idx) => idx);
}

function extractHand(player) {
  if (!player) return [];
  if (Array.isArray(player.holeCards) && player.holeCards.length) {
    return [...player.holeCards];
  }
  if (Array.isArray(player.hand) && player.hand.length) {
    return [...player.hand];
  }
  return [];
}
