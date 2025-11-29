// src/games/nlh/NLHGameController.js

import NLHGameDefinition from "./NLHGameDefinition.js";
import { evaluateNlhHand, compareNlhHands } from "./utils/nlhEvaluator.js";
import { DeckManager } from "../badugi/utils/deck.js";

function clonePlayer(player) {
  if (!player) return player;
  return {
    ...player,
    holeCards: Array.isArray(player.holeCards) ? [...player.holeCards] : [],
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
    const seats = (tableConfig?.seats ?? []).map((seat, idx) => ({
      seatIndex: seat?.seatIndex ?? idx,
      name: seat?.name ?? `Seat ${idx + 1}`,
      stack: seat?.stack ?? 0,
      totalInvested: seat?.totalInvested ?? 0,
      betThisStreet: 0,
      folded: false,
      allIn: seat?.stack <= 0,
      seatOut: seat?.seatOut ?? false,
      holeCards: [],
    }));
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
    return {
      ...this.state,
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
      this.state.players = (this.config.tableConfig?.seats ?? []).map((seat, idx) => ({
        seatIndex: seat?.seatIndex ?? idx,
        name: seat?.name ?? `Seat ${idx + 1}`,
        stack: seat?.stack ?? 0,
        totalInvested: seat?.totalInvested ?? 0,
        betThisStreet: 0,
        folded: false,
        allIn: seat?.stack <= 0,
        seatOut: seat?.seatOut ?? false,
        holeCards: [],
      }));
    }
    this.handCounter += 1;
    this.state.handId = handId ?? `nlh-hand-${this.handCounter}`;
    const players = this.state.players.map((player) => ({
      ...player,
      betThisStreet: 0,
      folded: player.stack <= 0 || player.seatOut,
      allIn: player.stack <= 0,
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
    for (let round = 0; round < 2; round += 1) {
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
    const pay = Math.min(player.stack, amount);
    player.stack -= pay;
    player.betThisStreet = (player.betThisStreet ?? 0) + pay;
    player.totalInvested = (player.totalInvested ?? 0) + pay;
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
      if (player && !player.seatOut) {
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

    switch ((action || "").toLowerCase()) {
      case "fold":
        player.folded = true;
        break;
      case "check":
        break;
      case "call": {
        const toCall = Math.max(0, this.state.currentBet - (player.betThisStreet ?? 0));
        this.commitChips(player, toCall);
        break;
      }
      case "bet":
      case "raise":
      case "all-in": {
        const raiseAmount = amount > 0 ? amount : player.stack;
        this.commitChips(player, raiseAmount);
        this.state.currentBet = Math.max(this.state.currentBet, player.betThisStreet ?? 0);
        break;
      }
      default:
        return { success: false, reason: "Unsupported action" };
    }

    this.state.pot = this.calculatePot();
    this.state.players[seatIndex] = { ...player };
    this.state.currentActor = this.nextActiveSeat(seatIndex);
    return { success: true, player: clonePlayer(player) };
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
    } else if (nextStreet === "FLOP" || nextStreet === "TURN" || nextStreet === "RIVER") {
      this.state.currentActor = this.nextActiveSeat(this.state.dealerIndex);
    }
    return this.getSnapshot();
  }

  resetStreetBets() {
    this.state.players = this.state.players.map((player) => ({
      ...player,
      betThisStreet: 0,
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
        player.holeCards.length === 2,
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
    const winners = evaluations.filter(
      (entry) => compareNlhHands(entry.evaluation, best.evaluation) === 0,
    );
    const resolvedPot = totalPot ?? this.calculatePot();
    const basePayout = winners.length ? Math.floor(resolvedPot / winners.length) : 0;
    let remainder = resolvedPot - basePayout * winners.length;
    const winnerSummaries = winners.map((entry) => {
      let payout = basePayout;
      if (remainder > 0) {
        payout += 1;
        remainder -= 1;
      }
      entry.player.stack += payout;
      return {
        seatIndex: entry.player.seatIndex,
        name: entry.player.name,
        payout,
        evaluation: entry.evaluation,
      };
    });
    const summary = {
      handId: this.state.handId,
      board,
      totalPot: resolvedPot,
      winners: winnerSummaries,
      potDetails: [
        {
          potIndex: 0,
          amount: resolvedPot,
          winnerSeatIndexes: winnerSummaries.map((winner) => winner.seatIndex),
        },
      ],
    };
    this.state.lastHandResult = summary;
    return summary;
  }
}

export default NLHGameController;
