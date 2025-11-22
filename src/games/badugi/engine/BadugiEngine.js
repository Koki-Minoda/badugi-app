import { DrawEngineBase } from "../../core/drawEngineBase.js";
import { cloneTableState } from "../../core/models.js";
import { IllegalActionError, assertSeatIsActive } from "../../core/errors.js";
import { DeckManager } from "../utils/deck.js";
import { getWinnersByBadugi } from "../utils/badugiEvaluator.js";
import { createBadugiTableState } from "./legacyState.js";
import { settleStreetToPots, calcDrawStartIndex, nextAliveFrom } from "./roundFlow.js";

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
    this.getDeckManager().reset();
    return createBadugiTableState(ctx);
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

    const sbIndex = findNextActiveSeat(players, (next.dealerIndex + 1) % players.length);
    const bbIndex = findNextActiveSeat(
      players,
      ((sbIndex !== -1 ? sbIndex : next.dealerIndex) + 1) % players.length,
      sbIndex
    );

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

    const actingPlayerIndex = findNextActiveSeat(
      players,
      ((bbIndex !== -1 ? bbIndex : sbIndex !== -1 ? sbIndex : next.dealerIndex) + 1) % players.length
    );

    next.players = players;
    next.lastAggressorIndex = bbIndex !== -1 ? bbIndex : sbIndex !== -1 ? sbIndex : next.dealerIndex;
    next.actingPlayerIndex = actingPlayerIndex === -1 ? next.dealerIndex : actingPlayerIndex;
    const committed = sumCommitted(players);
    next.metadata = {
      ...(next.metadata ?? {}),
      forcedBetsApplied: true,
      lastBlinds: { sbIndex, sbPay, bbIndex, bbPay },
      currentBet: computeCurrentBet(players),
      betHead: next.actingPlayerIndex,
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

    const metadata = action.metadata ?? {};

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
    };

    const nextRound = drawRound + 1;
    if (nextRound > maxDraws) {
      working.street = "SHOWDOWN";
      working.isHandOver = true;
      working.actingPlayerIndex = dealerIndex;
      const showdownResult = this.resolveShowdown(working, { cloneState: false });
      return {
        state: showdownResult?.state ?? working,
        street: "SHOWDOWN",
        drawRoundIndex: drawRound,
        showdown: true,
        players: showdownResult?.state?.players ?? working.players,
        pots: showdownResult?.state?.pots ?? working.pots,
        showdownSummary: showdownResult?.summary,
        totalPot: showdownResult?.totalPot,
      };
    }

    const drawStartBase = calcDrawStartIndex(
      dealerIndex,
      nextRound,
      numPlayers || working.players.length || 6
    );
    const firstToDraw = findDrawableSeat(working.players, drawStartBase);

    const resetPlayers = working.players.map((p) => ({
      ...p,
      hasDrawn: p.folded ? true : false,
      canDraw: !p.folded,
      lastAction: p.folded ? p.lastAction || metadata?.actionLabel || "Fold" : "",
    }));

    working.players = resetPlayers;
    working.drawRoundIndex = nextRound;
    working.street = "DRAW";
    working.actingPlayerIndex = firstToDraw;

    return {
      state: working,
      street: "DRAW",
      drawRoundIndex: nextRound,
      actingPlayerIndex: firstToDraw,
      players: working.players,
      pots: working.pots,
    };
  }

  getObservation(state, playerId) {
    const base = super.getObservation(state, playerId);
    const potTotal = (state.pots ?? []).reduce((sum, pot) => sum + (pot.amount ?? 0), 0);
    return {
      ...base,
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
    const pots = working.pots ?? [];
    const summary = [];
    let totalPot = 0;

    pots.forEach((pot, potIndex) => {
      const amount = Math.max(0, pot?.amount ?? 0);
      totalPot += amount;
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
          if (!player || player.folded || player.seatOut) return null;
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

      const winners = getWinnersByBadugi(contenders);
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
  const stack = Math.max(0, player.stack ?? 0);
  const pay = Math.min(stack, amount);
  if (pay <= 0) return { updated: player, paid: 0 };

  const updated = {
    ...player,
    stack: stack - pay,
    betThisRound: (player.betThisRound ?? 0) + pay,
  };

  if (updated.stack === 0) {
    updated.allIn = true;
    updated.hasActedThisRound = true;
  }

  return { updated, paid: pay };
}

function findNextActiveSeat(players, startIndex, skipIndex) {
  if (!Array.isArray(players) || players.length === 0) return -1;
  const n = players.length;
  let idx = ((startIndex % n) + n) % n;
  for (let step = 0; step < n; step += 1) {
    const seat = (idx + step) % n;
    if (seat === skipIndex) continue;
    if (isSeatEligible(players[seat])) return seat;
  }
  return -1;
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

function resolveRaiseSize(table, metadata = {}) {
  if (typeof metadata.raise === "number" && metadata.raise > 0) return metadata.raise;
  if (typeof metadata.raiseSize === "number" && metadata.raiseSize > 0) return metadata.raiseSize;
  if (typeof metadata.betSize === "number" && metadata.betSize > 0) return metadata.betSize;
  const defaultFromMeta = table?.metadata?.defaultRaiseSize;
  if (typeof defaultFromMeta === "number" && defaultFromMeta > 0) return defaultFromMeta;
  if (typeof table?.bigBlind === "number" && table.bigBlind > 0) return table.bigBlind;
  if (typeof table?.smallBlind === "number" && table.smallBlind > 0) return table.smallBlind * 2;
  const currentBet = Array.isArray(table?.players) ? computeCurrentBet(table.players) : 0;
  return Math.max(1, currentBet || 1);
}

function findDrawableSeat(players = [], startIndex = 0) {
  if (!players.length) return 0;
  const n = players.length;
  let idx = ((startIndex % n) + n) % n;
  for (let step = 0; step < n; step += 1) {
    const seat = (idx + step) % n;
    const pl = players[seat];
    if (!pl || pl.folded || pl.seatOut) continue;
    return seat;
  }
  return startIndex % n;
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
  target.lastDrawCount = drawCount;
  target.lastAction = metadata.actionLabel ?? (drawCount > 0 ? `DRAW(${drawCount})` : "Pat");
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
  player.folded = true;
  player.hasActedThisRound = true;
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
  if (typeof workingMeta.stackBefore !== "number") workingMeta.stackBefore = stackBefore;
  if (typeof workingMeta.betBefore !== "number") workingMeta.betBefore = betBefore;
  if (typeof workingMeta.stackAfter !== "number" || typeof workingMeta.betAfter !== "number") {
    const toCall = computeToCall(table, seatIndex);
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
  if (typeof workingMeta.stackBefore !== "number") workingMeta.stackBefore = stackBefore;
  if (typeof workingMeta.betBefore !== "number") workingMeta.betBefore = betBefore;
  if (typeof workingMeta.stackAfter !== "number" || typeof workingMeta.betAfter !== "number") {
    const toCall = computeToCall(table, seatIndex);
    const raiseSize = resolveRaiseSize(table, workingMeta);
    const total = toCall + raiseSize;
    const pay = Math.min(stackBefore, total);
    workingMeta.toCall = typeof workingMeta.toCall === "number" ? workingMeta.toCall : toCall;
    workingMeta.raise = typeof workingMeta.raise === "number" ? workingMeta.raise : raiseSize;
    workingMeta.paid = typeof workingMeta.paid === "number" ? workingMeta.paid : pay;
    workingMeta.betAfter = betBefore + workingMeta.paid;
    workingMeta.stackAfter = Math.max(0, stackBefore - workingMeta.paid);
  }
  applyStackAndBetSync(player, workingMeta, table);
  player.hasActedThisRound = true;
  player.lastAction =
    workingMeta.actionLabel ??
    (workingMeta.paid < ((workingMeta.toCall ?? 0) + (workingMeta.raise ?? 0))
      ? "Raise (All-in)"
      : "Raise");
  const meta = (table.metadata = { ...(table.metadata ?? {}) });
  meta.currentBet = computeCurrentBet(table.players);
  meta.betHead = seatIndex;
  table.lastAggressorIndex = seatIndex;
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
  const nextSeat = nextAliveFrom(table.players, seatIndex);
  if (typeof nextSeat === "number") {
    table.actingPlayerIndex = nextSeat;
    return nextSeat;
  }
  table.actingPlayerIndex = seatIndex;
  return seatIndex;
}

function updateBettingMetadata(table, seatIndex, actionType, metadata = {}) {
  const meta = ensureMetadata(table);
  meta.currentBet = computeCurrentBet(table.players);
  meta.totalCommitted = sumCommitted(table.players);
  meta.potAmount = sumPotAmounts(table.pots) + meta.totalCommitted;

  if (actionType === "RAISE") {
    meta.betHead = seatIndex;
    table.lastAggressorIndex = seatIndex;
  } else if (actionType === "FOLD" && meta.betHead === seatIndex) {
    const nextSeat = nextAliveFrom(table.players, seatIndex);
    meta.betHead = typeof nextSeat === "number" ? nextSeat : null;
    if (table.lastAggressorIndex === seatIndex) {
      table.lastAggressorIndex = meta.betHead;
    }
  } else if (typeof meta.betHead !== "number") {
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

  let stackAfter =
    typeof metadata.stackAfter === "number" ? metadata.stackAfter : undefined;
  let betAfter = typeof metadata.betAfter === "number" ? metadata.betAfter : undefined;
  let paid = typeof metadata.paid === "number" ? metadata.paid : undefined;

  if (typeof betAfter !== "number" || typeof stackAfter !== "number") {
    if (typeof paid !== "number") {
      const target =
        typeof metadata.toCall === "number"
          ? metadata.toCall + Math.max(0, metadata.raise ?? 0)
          : Math.max(
              0,
              (table ? computeCurrentBet(table.players) : betBefore) - betBefore
            );
      paid = Math.min(stackBefore, target);
    }
    betAfter = betBefore + paid;
    stackAfter = Math.max(0, stackBefore - paid);
  }

  player.stack = stackAfter;
  player.betThisRound = betAfter;

  const contribution = Math.max(0, betAfter - betBefore);
  if (contribution > 0) {
    player.totalInvested = (player.totalInvested ?? 0) + contribution;
  }

  if (player.stack === 0) {
    player.allIn = true;
    player.hasActedThisRound = true;
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
