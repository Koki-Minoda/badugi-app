// src/games/nlh/NLHGameController.js

import NLHGameDefinition from "./NLHGameDefinition.js";
import { evaluateNlhHand, compareNlhHands } from "./utils/nlhEvaluator.js";
import { DeckManager } from "../badugi/utils/deck.js";
import { applyChips } from "../core/applyChips.js";
import {
  applyPayoutsToPlayers,
  buildContributionPots,
  resolveEvaluationPot,
  summarizePayouts,
} from "../core/sidePotResolver.js";
import {
  chooseTeacherBetAction,
  estimateBoardHandStrength,
} from "../core/cpuTeacherPolicy.js";

function clonePlayer(player) {
  if (!player) return player;
  return {
    ...player,
    holeCards: Array.isArray(player.holeCards) ? [...player.holeCards] : [],
  };
}

function buildPlayerFromSeat(seat, idx) {
  return {
    seatIndex: seat?.seatIndex ?? idx,
    playerId: seat?.playerId ?? null,
    name: seat?.name ?? `Seat ${idx + 1}`,
    avatar: seat?.avatar ?? null,
    avatarUrl: seat?.avatarUrl ?? null,
    cpuCharacterId: seat?.cpuCharacterId ?? null,
    cpuStyle: seat?.cpuStyle ?? null,
    stack: seat?.stack ?? 0,
    totalInvested: seat?.totalInvested ?? 0,
    betThisStreet: 0,
    folded: false,
    allIn: seat?.stack <= 0,
    seatOut: seat?.seatOut ?? false,
    holeCards: [],
  };
}

function defaultDeckFactory() {
  return new DeckManager();
}

function defaultTableConfig() {
  return {
    seats: [],
    blinds: { sb: 1, bb: 2, ante: 0 },
  };
}

export class NLHGameController {
  constructor({
    tableConfig = defaultTableConfig(),
    rng = Math.random,
    gameDefinition = NLHGameDefinition,
    deckFactory = defaultDeckFactory,
  } = {}) {
    this.config = {
      tableConfig,
      rng,
      gameDefinition,
      deckFactory,
    };
    const seats = (tableConfig?.seats ?? []).map(buildPlayerFromSeat);
    this.state = {
      players: seats,
      boardCards: [],
      street: "IDLE",
      dealerIndex: -1,
      smallBlindIndex: null,
      bigBlindIndex: null,
      currentActor: null,
      pot: 0,
      handId: null,
      lastHandResult: null,
      currentBet: 0,
    };
    this.deck = null;
    this.handCounter = 0;
  }

  get holeCardCount() {
    if (Number.isFinite(this._holeCardCount) && this._holeCardCount > 0) {
      return this._holeCardCount;
    }
    const count = this.config.gameDefinition?.handStructure?.hole;
    return Number.isFinite(count) && count > 0 ? count : 2;
  }

  set holeCardCount(value) {
    this._holeCardCount = value;
  }

  updateTableConfig(tableConfig = {}) {
    this.config.tableConfig = {
      ...(this.config.tableConfig ?? {}),
      ...tableConfig,
    };
  }

  syncExternalState(partial = {}) {
    if (partial.players) {
      this.state.players = partial.players.map(clonePlayer);
    }
    this.state = {
      ...this.state,
      ...partial,
    };
  }

  get seatsCount() {
    return this.state.players.length;
  }

  get blinds() {
    const blinds = this.config.tableConfig?.blinds ?? {};
    return {
      sb: blinds.sb ?? 1,
      bb: blinds.bb ?? 2,
      ante: blinds.ante ?? 0,
    };
  }

  getSnapshot() {
    const phase = this.state.street === "SHOWDOWN" ? "SHOWDOWN" : "BET";
    return {
      ...this.state,
      phase,
      turn: this.state.currentActor,
      nextTurn: this.state.currentActor,
      pots: [{ amount: this.calculatePot(), potAmount: this.calculatePot() }],
      players: this.state.players.map(clonePlayer),
      boardCards: [...this.state.boardCards],
    };
  }

  resetDeck() {
    const deckInstance = this.config.deckFactory
      ? this.config.deckFactory()
      : defaultDeckFactory();
    this.deck = deckInstance;
    if (typeof this.deck.reset === "function") {
      this.deck.reset();
    }
  }

  drawCards(count) {
    if (!this.deck) {
      this.resetDeck();
    }
    if (typeof this.deck.draw === "function") {
      return this.deck.draw(count);
    }
    if (Array.isArray(this.deck.cards)) {
      return this.deck.cards.splice(0, count);
    }
    throw new Error("NLHGameController deck does not support draw()");
  }

  startNewHand({ handId = null } = {}) {
    if (!this.state.players.length) {
      this.state.players = (this.config.tableConfig?.seats ?? []).map(buildPlayerFromSeat);
    }
    this.handCounter += 1;
    this.state.handId = handId ?? `nlh-hand-${this.handCounter}`;
    this.state.lastHandResult = null;
    const players = this.state.players.map((player) => ({
      ...player,
      totalInvested: 0,
      betThisStreet: 0,
      folded: player.stack <= 0 || player.seatOut,
      allIn: player.stack <= 0,
      hasActedThisStreet: false,
      lastAction: "",
      holeCards: [],
    }));
    this.state.boardCards = [];
    this.state.street = "PREFLOP";
    this.resetDeck();

    this.state.dealerIndex = this.nextOccupiedSeat(
      this.state.dealerIndex,
      { allowSame: false, players },
    );
    if (this.state.dealerIndex === null) {
      this.state.dealerIndex = 0;
    }

    const sbIndex = this.nextOccupiedSeat(this.state.dealerIndex, { allowSame: false, players });
    const bbIndex = this.nextOccupiedSeat(sbIndex, { allowSame: false, players });
    this.state.smallBlindIndex = sbIndex;
    this.state.bigBlindIndex = bbIndex;

    this.dealHoleCards(players);
    this.applyAntes(players);
    this.applyBlind(players, sbIndex, this.blinds.sb);
    this.applyBlind(players, bbIndex, this.blinds.bb);
    this.state.currentBet = Math.max(
      players[sbIndex]?.betThisStreet ?? 0,
      players[bbIndex]?.betThisStreet ?? 0,
    );
    this.state.currentActor = this.nextActiveSeat(bbIndex, players);
    this.state.players = players;
    this.state.pot = this.calculatePot(players);
    return this.getSnapshot();
  }

  dealHoleCards(players) {
    const activeSeats = players.filter((p) => !p.folded && !p.seatOut);
    for (let round = 0; round < this.holeCardCount; round += 1) {
      activeSeats.forEach((player) => {
        const [card] = this.drawCards(1);
        if (card) {
          player.holeCards = player.holeCards ? [...player.holeCards, card] : [card];
        }
      });
    }
  }

  applyAntes(players) {
    const ante = this.blinds.ante ?? 0;
    if (!ante) return;
    players.forEach((player) => {
      if (player.folded || player.seatOut || player.stack <= 0) return;
      this.commitChips(player, ante);
    });
  }

  applyBlind(players, seatIndex, amount) {
    if (seatIndex == null) return;
    const player = players[seatIndex];
    if (!player || player.folded || player.seatOut) return;
    this.commitChips(player, amount);
  }

  commitChips(player, amount) {
    const applied = applyChips(player, amount);
    player.betThisStreet = (player.betThisStreet ?? 0) + applied;
    if (player.stack === 0) {
      player.allIn = true;
    }
  }

  calculatePot(players = this.state.players) {
    return players.reduce((sum, player) => sum + (player.totalInvested ?? 0), 0);
  }

  nextOccupiedSeat(startIdx, { allowSame = true, players = this.state.players } = {}) {
    if (!players.length) return null;
    const total = players.length;
    const start = typeof startIdx === "number" && startIdx >= 0 ? startIdx : -1;
    for (let offset = allowSame ? 0 : 1; offset <= total; offset += 1) {
      const idx = (start + offset + total) % total;
      const player = players[idx];
      if (
        player &&
        !player.seatOut &&
        !player.isBusted &&
        (typeof player.stack !== "number" || player.stack > 0)
      ) {
        return idx;
      }
    }
    return null;
  }

  nextActiveSeat(fromIndex, players = this.state.players) {
    if (!players.length) return null;
    const total = players.length;
    for (let i = 1; i <= total; i += 1) {
      const idx = (fromIndex + i) % total;
      const player = players[idx];
      if (!player || player.seatOut || player.folded || player.allIn || player.stack <= 0) {
        continue;
      }
      return idx;
    }
    return null;
  }

  applyPlayerAction({ seatIndex, action, amount = 0 } = {}) {
    if (typeof seatIndex !== "number") {
      return { success: false, reason: "Invalid seat index" };
    }
    const player = this.state.players[seatIndex];
    if (!player) {
      return { success: false, reason: "Player not found" };
    }
    if (player.folded || player.seatOut || player.allIn) {
      return { success: false, reason: "Player cannot act" };
    }

    const actionName = (action || "").toLowerCase();
    switch (actionName) {
      case "fold":
        player.folded = true;
        player.lastAction = "Fold";
        break;
      case "check":
        player.lastAction = "Check";
        break;
      case "call": {
        const toCall = Math.max(0, this.state.currentBet - (player.betThisStreet ?? 0));
        this.commitChips(player, toCall);
        player.lastAction = toCall > 0 ? "Call" : "Check";
        break;
      }
      case "bet":
      case "raise":
      case "all-in": {
        const raiseAmount = amount > 0 ? amount : player.stack;
        this.commitChips(player, raiseAmount);
        this.state.currentBet = Math.max(this.state.currentBet, player.betThisStreet ?? 0);
        player.lastAction = actionName === "all-in" ? "All-in" : actionName === "raise" ? "Raise" : "Bet";
        break;
      }
      default:
        return { success: false, reason: "Unsupported action" };
    }
    player.hasActedThisStreet = true;

    this.state.pot = this.calculatePot();
    this.state.players[seatIndex] = { ...player };
    const remainingContenders = this.state.players.filter(
      (p) => p && !p.folded && !p.seatOut,
    );
    if (remainingContenders.length <= 1) {
      this.resolveUncontested();
    } else if (this.isBettingRoundComplete()) {
      this.advanceStreet();
    } else {
      this.state.currentActor = this.nextActiveSeat(seatIndex);
    }
    return { success: true, player: clonePlayer(player) };
  }

  evaluateCpuStrength(player) {
    const board = [...(this.state.boardCards ?? [])];
    let evaluation = null;
    if (board.length >= 3 && Array.isArray(player?.holeCards) && player.holeCards.length) {
      try {
        evaluation = evaluateNlhHand({ cards: [...player.holeCards, ...board] });
      } catch {
        evaluation = null;
      }
    }
    return estimateBoardHandStrength({
      holeCards: player?.holeCards ?? [],
      boardCards: board,
      evaluation,
      variantId: this.config.gameDefinition?.id ?? "B01",
      position: this.getPositionLabel(player?.seatIndex),
    });
  }

  getPositionLabel(seatIndex, players = this.state.players) {
    if (seatIndex == null) return "MP";
    if (seatIndex === this.state.dealerIndex) return "BTN";
    if (seatIndex === this.state.smallBlindIndex) return "SB";
    if (seatIndex === this.state.bigBlindIndex) return "BB";
    const activeOrder = [];
    let cursor = this.state.bigBlindIndex;
    for (let i = 0; i < players.length; i += 1) {
      cursor = this.nextOccupiedSeat(cursor, { allowSame: false, players });
      if (cursor == null || activeOrder.includes(cursor)) break;
      if (cursor !== this.state.dealerIndex && cursor !== this.state.smallBlindIndex && cursor !== this.state.bigBlindIndex) {
        activeOrder.push(cursor);
      }
    }
    const idx = activeOrder.indexOf(seatIndex);
    if (idx <= 0) return "UTG";
    if (idx === activeOrder.length - 1) return "CO";
    return "MP";
  }

  getCpuAction(state = this.getSnapshot(), seatIndex = state?.currentActor, options = {}) {
    const player = state?.players?.[seatIndex];
    if (!state || typeof seatIndex !== "number" || !player || player.folded || player.seatOut || player.allIn) {
      return null;
    }
    if (state.currentActor !== null && state.currentActor !== seatIndex) {
      return null;
    }
    const currentBet = Number(state.currentBet ?? 0) || 0;
    const playerBet = Number(player.betThisStreet ?? player.bet ?? 0) || 0;
    const toCall = Math.max(0, currentBet - playerBet);
    const strength = this.evaluateCpuStrength(player);
    const activeOpponents = state.players.filter(
      (entry, idx) => idx !== seatIndex && entry && !entry.folded && !entry.seatOut && !entry.allIn,
    ).length;
    const betAmount =
      this.config.gameDefinition?.betting?.structure === "fixed-limit" && typeof this.getLimitUnit === "function"
        ? this.getLimitUnit()
        : Math.max(this.blinds.bb ?? 2, toCall);
    const decision = chooseTeacherBetAction({
      strength,
      toCall,
      canRaise: !player.allIn && (player.stack ?? 0) > 0,
      tierConfig: options.tierConfig,
      betAmount,
      currentBet,
      playerBet,
      street: state.street,
      variantId: this.config.gameDefinition?.id ?? "B01",
      position: this.getPositionLabel(seatIndex, state.players),
      activeOpponents,
    });
    return {
      seatIndex,
      ...decision,
      metadata: {
        ...(decision.metadata ?? {}),
        strength,
        position: this.getPositionLabel(seatIndex, state.players),
        tierId: options.tierConfig?.id ?? "standard",
      },
    };
  }

  isBettingRoundComplete() {
    const activePlayers = this.state.players.filter(
      (player) => player && !player.folded && !player.seatOut && !player.allIn,
    );
    if (activePlayers.length === 0) return true;
    return activePlayers.every(
      (player) =>
        player.hasActedThisStreet === true &&
        (player.betThisStreet ?? 0) === (this.state.currentBet ?? 0),
    );
  }

  advanceStreet() {
    const nextStreet = this.getNextStreet(this.state.street);
    if (nextStreet === this.state.street) {
      return this.getSnapshot();
    }
    if (nextStreet === "FLOP") {
      this.state.boardCards = [...this.state.boardCards, ...this.drawCards(3)];
    } else if (nextStreet === "TURN" || nextStreet === "RIVER") {
      this.state.boardCards = [...this.state.boardCards, ...this.drawCards(1)];
    }
    this.resetStreetBets();
    this.state.street = nextStreet;
    if (nextStreet === "SHOWDOWN") {
      this.state.currentActor = null;
      this.resolveShowdown();
    } else if (nextStreet === "FLOP" || nextStreet === "TURN" || nextStreet === "RIVER") {
      this.state.currentActor = this.nextActiveSeat(this.state.dealerIndex);
    }
    return this.getSnapshot();
  }

  resetStreetBets() {
    this.state.players = this.state.players.map((player) => ({
      ...player,
      betThisStreet: 0,
      hasActedThisStreet: false,
    }));
    this.state.currentBet = 0;
  }

  getNextStreet(currentStreet) {
    switch (currentStreet) {
      case "PREFLOP":
        return "FLOP";
      case "FLOP":
        return "TURN";
      case "TURN":
        return "RIVER";
      case "RIVER":
        return "SHOWDOWN";
      default:
        return "PREFLOP";
    }
  }

  resolveShowdown({ totalPot = null } = {}) {
    if (this.state.street !== "SHOWDOWN") {
      this.state.street = "SHOWDOWN";
    }
    const contenders = this.state.players.filter(
      (player) =>
        player &&
        !player.folded &&
        !player.seatOut &&
        Array.isArray(player.holeCards) &&
        player.holeCards.length >= this.holeCardCount,
    );
    const board = [...this.state.boardCards];
    const evaluations = contenders.map((player) => {
      const cards = [...player.holeCards, ...board];
      return {
        player,
        evaluation: evaluateNlhHand({ cards }),
      };
    });
    let best = null;
    evaluations.forEach((entry) => {
      if (!best || compareNlhHands(entry.evaluation, best.evaluation) < 0) {
        best = entry;
      }
    });
    const resolvedPot = totalPot ?? this.calculatePot();
    if (!best) {
      const summary = {
        handId: this.state.handId,
        board,
        totalPot: resolvedPot,
        winners: [],
        potDetails: [],
      };
      this.state.lastHandResult = summary;
      return summary;
    }
    const winners = evaluations.filter(
      (entry) => compareNlhHands(entry.evaluation, best.evaluation) === 0,
    );
    const contributionPots = buildContributionPots(this.state.players);
    const potsToResolve = contributionPots.length
      ? contributionPots
      : [
          {
            potIndex: 0,
            amount: resolvedPot,
            potAmount: resolvedPot,
            eligibleSeatIndexes: winners.map((entry) => entry.player.seatIndex),
          },
        ];
    const allPayouts = [];
    const potDetails = potsToResolve.map((pot, potIndex) => {
      const payouts = resolveEvaluationPot({
        amount: pot.amount,
        eligibleSeatIndexes: pot.eligibleSeatIndexes,
        evaluations,
        compareEvaluations: compareNlhHands,
      });
      allPayouts.push(...payouts);
      return {
        potIndex: pot.potIndex ?? potIndex,
        amount: pot.amount,
        potAmount: pot.amount,
        eligibleSeatIndexes: [...(pot.eligibleSeatIndexes ?? [])],
        winnerSeatIndexes: payouts.map((winner) => winner.player.seatIndex),
        winners: payouts.map((winner) => ({
          seatIndex: winner.player.seatIndex,
          name: winner.player.name,
          payout: winner.payout,
          evaluation: winner.evaluation,
        })),
      };
    });
    applyPayoutsToPlayers(this.state.players, allPayouts);
    const winnerSummaries = summarizePayouts(allPayouts);
    const summary = {
      handId: this.state.handId,
      board,
      totalPot: resolvedPot,
      winners: winnerSummaries,
      potDetails,
    };
    this.state.lastHandResult = summary;
    return summary;
  }

  resolveUncontested() {
    const winner = this.state.players.find((player) => player && !player.folded && !player.seatOut);
    const resolvedPot = this.calculatePot();
    if (winner) {
      winner.stack += resolvedPot;
    }
    this.state.street = "SHOWDOWN";
    this.state.currentActor = null;
    this.state.lastHandResult = {
      handId: this.state.handId,
      board: [...this.state.boardCards],
      totalPot: resolvedPot,
      winners: winner
        ? [{ seatIndex: winner.seatIndex, name: winner.name, payout: resolvedPot, evaluation: null }]
        : [],
      potDetails: [
        {
          potIndex: 0,
          amount: resolvedPot,
          winnerSeatIndexes: winner ? [winner.seatIndex] : [],
        },
      ],
    };
    return this.state.lastHandResult;
  }
}

export default NLHGameController;
