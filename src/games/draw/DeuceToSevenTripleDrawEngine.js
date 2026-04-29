import { DrawEngineBase } from "../core/drawEngineBase.js";
import { cloneTableState, createTableState } from "../core/models.js";
import { IllegalActionError, assertSeatIsActive } from "../core/errors.js";
import { DeckManager } from "../badugi/utils/deck.js";
import { evaluateLowHand, formatLowHandLabel } from "../evaluators/low.js";

const DEFAULT_SEAT_CONFIG = ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"];

function isEmptySeat(seatType) {
  return seatType === "EMPTY";
}

function createPlayers({ seatConfig = DEFAULT_SEAT_CONFIG, startingStack = 500, heroProfile = {} } = {}) {
  return seatConfig.map((seatType, seatIndex) => {
    const sittingOut = isEmptySeat(seatType);
    const isHuman = seatType === "HUMAN";
    return {
      id: `seat-${seatIndex}`,
      playerId: `seat-${seatIndex}`,
      name: isHuman ? heroProfile?.name ?? "You" : `CPU ${seatIndex + 1}`,
      seatIndex,
      seatType,
      isCPU: !isHuman && !sittingOut,
      hand: [],
      stack: sittingOut ? 0 : startingStack,
      bet: 0,
      totalInvested: 0,
      folded: sittingOut,
      allIn: false,
      sittingOut,
      seatOut: sittingOut,
      hasActedThisRound: false,
      hasDrawn: false,
      lastDrawCount: 0,
      lastAction: "",
    };
  });
}

function getActivePlayers(players = []) {
  return players.filter((player) => !player.folded && !player.sittingOut);
}

function getActiveSeatIndexes(players = []) {
  return players
    .map((player, seatIndex) => ({ player, seatIndex }))
    .filter(({ player }) => !player.folded && !player.sittingOut && !player.allIn)
    .map(({ seatIndex }) => seatIndex);
}

function findFirstActiveSeat(players = [], startIndex = 0) {
  if (!players.length) return null;
  for (let offset = 0; offset < players.length; offset += 1) {
    const seatIndex = (startIndex + offset) % players.length;
    const player = players[seatIndex];
    if (player && !player.folded && !player.sittingOut && !player.allIn) {
      return seatIndex;
    }
  }
  return null;
}

function findSeatIndex(state, action = {}) {
  if (typeof action.seatIndex === "number") return action.seatIndex;
  if (typeof action.playerId === "string") {
    return state.players.findIndex((player) => player.playerId === action.playerId || player.id === action.playerId);
  }
  return state.actingPlayerIndex;
}

function normalizeDiscardIndexes(discardIndexes = [], handLength = 5) {
  if (!Array.isArray(discardIndexes)) {
    throw new IllegalActionError("DRAW requires discardIndexes");
  }
  const normalized = discardIndexes.map((idx) => Number(idx));
  const unique = new Set(normalized);
  if (unique.size !== normalized.length) {
    throw new IllegalActionError("discardIndexes must be unique", { discardIndexes });
  }
  normalized.forEach((idx) => {
    if (!Number.isInteger(idx) || idx < 0 || idx >= handLength) {
      throw new IllegalActionError("discardIndexes contains an out-of-range index", {
        discardIndexes,
        handLength,
      });
    }
  });
  return normalized.sort((a, b) => a - b);
}

function getCardsInPlay(players = []) {
  return players.flatMap((player) => player.hand ?? []);
}

function settleCurrentBets(state) {
  const committed = state.players.reduce((sum, player) => sum + Math.max(0, player.bet ?? 0), 0);
  const players = state.players.map((player) => ({
    ...player,
    bet: 0,
    hasActedThisRound: false,
  }));
  const existingPots = Array.isArray(state.pots) ? state.pots.map((pot) => ({ ...pot })) : [];
  if (committed > 0) {
    if (existingPots.length) {
      existingPots[0] = {
        ...existingPots[0],
        amount: Math.max(0, existingPots[0].amount ?? 0) + committed,
      };
    } else {
      existingPots.push({
        amount: committed,
        eligiblePlayerIds: getActivePlayers(players).map((player) => player.playerId ?? player.id),
      });
    }
  }
  return { players, pots: existingPots, committed };
}

export class DeuceToSevenTripleDrawEngine extends DrawEngineBase {
  constructor({ deckManager = null } = {}) {
    super({ gameId: "deuce_to_seven_triple_draw", displayName: "2-7 Triple Draw", maxDrawRounds: 3 });
    this.variantId = "D01";
    this.evaluatorTag = "low-27";
    this.deckManager = deckManager ?? new DeckManager();
  }

  getDeckManager() {
    if (!this.deckManager) {
      this.deckManager = new DeckManager();
    }
    return this.deckManager;
  }

  initHand(ctx = {}) {
    const deckManager = this.getDeckManager();
    deckManager.reset?.();
    const dealtCards = [];
    const players = createPlayers(ctx).map((player) => {
      if (player.sittingOut) return player;
      const hand = deckManager.draw(5, { activeCards: dealtCards });
      dealtCards.push(...hand);
      return {
        ...player,
        hand,
      };
    });

    return createTableState({
      handId: ctx.handId,
      gameId: this.id,
      engineId: this.id,
      players,
      dealerIndex: ctx.dealerIndex ?? 0,
      smallBlind: ctx.structure?.sb ?? 10,
      bigBlind: ctx.structure?.bb ?? 20,
      ante: ctx.structure?.ante ?? 0,
      street: "BET",
      drawRoundIndex: 0,
      actingPlayerIndex: null,
      lastAggressorIndex: null,
      pots: [],
      metadata: {
        variantId: this.variantId,
        bettingStructure: "fixed-limit",
        evaluator: this.evaluatorTag,
        maxDrawRounds: this.maxDrawRounds,
        smallBetBB: 1,
        bigBetBB: 2,
        raiseCap: 4,
        pendingDrawSeats: [],
        discardCountBySeat: {},
      },
    });
  }

  applyForcedBets(state) {
    const next = super.applyForcedBets(state);
    const active = next.players.filter((player) => !player.folded && !player.sittingOut);
    next.actingPlayerIndex = active.length
      ? (next.dealerIndex + 3) % next.players.length
      : null;
    next.lastAggressorIndex = active.length
      ? (next.dealerIndex + 2) % next.players.length
      : null;
    next.metadata = {
      ...(next.metadata ?? {}),
      currentBet: Math.max(0, ...active.map((player) => player.bet ?? 0)),
      lastAggressorIndex: next.lastAggressorIndex,
    };
    return next;
  }

  advanceAfterBet(state) {
    if (!state) {
      throw new IllegalActionError("Table state is required");
    }
    const next = cloneTableState(state);
    const { players, pots, committed } = settleCurrentBets(next);
    next.players = players;
    next.pots = pots;

    const nextDrawRound = (next.drawRoundIndex ?? 0) + 1;
    next.metadata = {
      ...(next.metadata ?? {}),
      currentBet: 0,
      lastCommittedToPot: committed,
      potAmount: pots.reduce((sum, pot) => sum + Math.max(0, pot.amount ?? 0), 0),
    };

    if (nextDrawRound > this.maxDrawRounds) {
      next.street = "SHOWDOWN";
      next.isHandOver = true;
      next.actingPlayerIndex = null;
      return next;
    }

    return this.transitionToDraw(next, nextDrawRound);
  }

  transitionToDraw(state, drawRoundIndex = this.getNextDrawRound(state)) {
    const next = cloneTableState(state);
    next.street = "DRAW";
    next.drawRoundIndex = drawRoundIndex;
    next.players = next.players.map((player) => {
      const canDraw = !player.folded && !player.sittingOut && !player.allIn;
      return {
        ...player,
        hasDrawn: !canDraw,
        canDraw,
        hasActedThisRound: !canDraw,
      };
    });
    next.actingPlayerIndex = findFirstActiveSeat(next.players, (next.dealerIndex ?? 0) + 1);
    next.metadata = {
      ...(next.metadata ?? {}),
      pendingDrawSeats: getActiveSeatIndexes(next.players),
      discardCountBySeat: {},
    };
    return next;
  }

  transitionToBet(state) {
    const next = cloneTableState(state);
    next.street = "BET";
    next.players = next.players.map((player) => ({
      ...player,
      bet: 0,
      hasActedThisRound: player.folded || player.sittingOut || player.allIn,
      canDraw: false,
    }));
    next.actingPlayerIndex = findFirstActiveSeat(next.players, (next.dealerIndex ?? 0) + 1);
    next.lastAggressorIndex = null;
    next.metadata = {
      ...(next.metadata ?? {}),
      currentBet: 0,
      pendingDrawSeats: [],
    };
    return next;
  }

  applyPlayerAction(state, action = {}) {
    if (action?.type !== "DRAW") {
      throw new IllegalActionError(`${this.id}: only DRAW actions are implemented for this step`, {
        actionType: action?.type,
      });
    }
    return this.applyDrawAction(state, action);
  }

  applyDrawAction(state, action = {}) {
    if (!state) {
      throw new IllegalActionError("Table state is required");
    }
    if (state.street !== "DRAW") {
      throw new IllegalActionError("DRAW action is only allowed during DRAW street", {
        street: state.street,
      });
    }

    const next = cloneTableState(state);
    const seatIndex = findSeatIndex(next, action);
    const player = next.players[seatIndex];
    assertSeatIsActive(player, { seatIndex, actionType: "DRAW" });
    if (player.folded || player.sittingOut || player.allIn || player.canDraw === false) {
      throw new IllegalActionError("Seat cannot draw in the current round", { seatIndex });
    }
    if (next.actingPlayerIndex !== null && seatIndex !== next.actingPlayerIndex) {
      throw new IllegalActionError("DRAW action is out of turn", {
        seatIndex,
        actingPlayerIndex: next.actingPlayerIndex,
      });
    }
    if (player.hasDrawn) {
      throw new IllegalActionError("Seat has already drawn this round", { seatIndex });
    }

    const handBefore = [...(player.hand ?? [])];
    const discardIndexes = normalizeDiscardIndexes(action.discardIndexes ?? [], handBefore.length);
    const discardedCards = discardIndexes.map((idx) => handBefore[idx]);
    const keptCards = handBefore.filter((_, idx) => !discardIndexes.includes(idx));
    if (discardedCards.length) {
      this.getDeckManager().discard(discardedCards);
    }
    const replacementCards = this.getDeckManager().draw(discardedCards.length, {
      activeCards: getCardsInPlay(next.players).filter((card) => !discardedCards.includes(card)),
    });
    player.hand = [...keptCards, ...replacementCards];
    player.hasDrawn = true;
    player.hasActedThisRound = true;
    player.lastDrawCount = discardedCards.length;
    player.lastAction = discardedCards.length === 0 ? "Pat" : `DRAW(${discardedCards.length})`;

    const pendingDrawSeats = getActiveSeatIndexes(next.players).filter(
      (idx) => !next.players[idx]?.hasDrawn,
    );
    next.metadata = {
      ...(next.metadata ?? {}),
      pendingDrawSeats,
      discardCountBySeat: {
        ...(next.metadata?.discardCountBySeat ?? {}),
        [seatIndex]: discardedCards.length,
      },
      lastDrawAction: {
        seatIndex,
        discardIndexes,
        discardedCards,
        replacementCards,
        drawRoundIndex: next.drawRoundIndex ?? 0,
      },
    };

    if (!pendingDrawSeats.length) {
      return this.transitionToBet(next);
    }
    next.actingPlayerIndex = pendingDrawSeats[0];
    return next;
  }

  evaluateShowdownHand(cards = []) {
    const evaluation = evaluateLowHand({ cards, lowType: "27" });
    return {
      ...evaluation,
      handName: formatLowHandLabel(evaluation, { lowType: "27" }),
    };
  }
}
