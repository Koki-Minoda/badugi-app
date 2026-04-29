import { DrawEngineBase } from "../core/drawEngineBase.js";
import { createTableState } from "../core/models.js";
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

  evaluateShowdownHand(cards = []) {
    const evaluation = evaluateLowHand({ cards, lowType: "27" });
    return {
      ...evaluation,
      handName: formatLowHandLabel(evaluation, { lowType: "27" }),
    };
  }
}
