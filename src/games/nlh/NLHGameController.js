// src/games/nlh/NLHGameController.js

import NLHGameDefinition from "./NLHGameDefinition.js";
import { evaluateNlhHand, compareNlhHands } from "./utils/nlhEvaluator.js";
import { DeckManager } from "../badugi/utils/deck.js";
import { applyChips } from "../core/applyChips.js";
import {
  applyPayoutsToPlayers,
  resolveHighContributionPots,
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
    hasFolded: false,
    allIn: seat?.stack <= 0,
    seatOut: seat?.seatOut ?? false,
    holeCards: [],
  };
}

function defaultDeckFactory(options = {}) {
  return new DeckManager(options);
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
      lastFullRaiseSize: 0,
      raiseRestrictedSeatIndexes: [],
    };
    this.deck = null;
    this.burnedCards = [];
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
      ? this.config.deckFactory({ rng: this.config.rng })
      : defaultDeckFactory({ rng: this.config.rng });
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
      hasFolded: false,
      allIn: player.stack <= 0,
      hasActedThisStreet: false,
      hasActedThisRound: false,
      lastAction: "",
      holeCards: [],
    }));
    this.state.boardCards = [];
    this.burnedCards = [];
    this.state.raiseRestrictedSeatIndexes = [];
    this.state.street = "PREFLOP";
    this.resetDeck();

    this.state.dealerIndex = this.nextOccupiedSeat(
      this.state.dealerIndex,
      { allowSame: false, players },
    );
    if (this.state.dealerIndex === null) {
      this.state.dealerIndex = 0;
    }

    const occupiedSeats = players.filter(
      (player) => player && !player.seatOut && !player.isBusted && player.stack > 0,
    );
    const headsUp = occupiedSeats.length === 2;
    const sbIndex = headsUp
      ? this.state.dealerIndex
      : this.nextOccupiedSeat(this.state.dealerIndex, { allowSame: false, players });
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
    this.state.lastFullRaiseSize = Math.max(1, this.blinds.bb ?? 2);
    this.state.currentActor = headsUp ? sbIndex : this.nextActiveSeat(bbIndex, players);
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
    if (this.state.currentActor != null && seatIndex !== this.state.currentActor) {
      return { success: false, reason: "Action is out of turn" };
    }

    const actionName = (action || "").toLowerCase();
    const playerBet = Math.max(0, Number(player.betThisStreet ?? 0) || 0);
    const currentBet = Math.max(0, Number(this.state.currentBet ?? 0) || 0);
    const toCall = Math.max(0, currentBet - playerBet);
    let fullRaise = false;
    switch (actionName) {
      case "fold":
        player.folded = true;
        player.hasFolded = true;
        player.lastAction = "Fold";
        break;
      case "check":
        if (toCall > 0) {
          return { success: false, reason: "Cannot check while facing a bet" };
        }
        player.lastAction = "Check";
        break;
      case "call": {
        this.commitChips(player, toCall);
        player.lastAction = toCall > 0 ? "Call" : "Check";
        break;
      }
      case "bet":
      case "raise":
      case "all-in": {
        if (
          (actionName === "raise" || actionName === "all-in") &&
          (this.state.raiseRestrictedSeatIndexes ?? []).includes(seatIndex) &&
          playerBet + player.stack > currentBet
        ) {
          return { success: false, reason: "Betting was not reopened by the short all-in" };
        }
        if (actionName === "bet" && currentBet > 0) {
          return { success: false, reason: "Cannot bet after betting has opened; use raise" };
        }
        if (actionName === "raise" && currentBet === 0) {
          return { success: false, reason: "Cannot raise before betting has opened; use bet" };
        }
        const requestedCommit = actionName === "all-in"
          ? player.stack
          : Math.max(0, Number(amount) || 0);
        if (requestedCommit <= 0) {
          return { success: false, reason: "Bet amount must be positive" };
        }
        const actualCommit = Math.min(player.stack, requestedCommit);
        const nextPlayerBet = playerBet + actualCommit;
        if (nextPlayerBet <= currentBet && actionName !== "all-in") {
          return { success: false, reason: "Raise must increase the current bet" };
        }
        const raiseSize = Math.max(0, nextPlayerBet - currentBet);
        const minimumRaise = currentBet === 0
          ? Math.max(1, this.blinds.bb ?? 2)
          : Math.max(1, this.state.lastFullRaiseSize ?? this.blinds.bb ?? 2);
        const isAllInCommit = actualCommit === player.stack;
        if (raiseSize > 0 && raiseSize < minimumRaise && !isAllInCommit) {
          return { success: false, reason: `Minimum raise is ${minimumRaise}` };
        }
        this.commitChips(player, actualCommit);
        if ((player.betThisStreet ?? 0) > currentBet) {
          this.state.currentBet = player.betThisStreet;
          fullRaise = raiseSize >= minimumRaise;
          if (fullRaise) {
            this.state.lastFullRaiseSize = raiseSize;
            this.state.raiseRestrictedSeatIndexes = [];
          } else if (raiseSize > 0) {
            this.state.raiseRestrictedSeatIndexes = this.state.players
              .map((entry, index) =>
                index !== seatIndex &&
                entry &&
                !entry.folded &&
                !entry.seatOut &&
                !entry.allIn &&
                entry.hasActedThisStreet === true
                  ? index
                  : null,
              )
              .filter((index) => index != null);
          }
        }
        player.lastAction = player.allIn
          ? "All-in"
          : actionName === "raise"
            ? "Raise"
            : "Bet";
        break;
      }
      default:
        return { success: false, reason: "Unsupported action" };
    }
    if (fullRaise) {
      this.state.players.forEach((entry, index) => {
        if (index !== seatIndex && entry && !entry.folded && !entry.seatOut && !entry.allIn) {
          entry.hasActedThisStreet = false;
        }
      });
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
        : toCall + Math.max(this.blinds.bb ?? 2, this.state.lastFullRaiseSize ?? 0);
    const decision = chooseTeacherBetAction({
      strength,
      toCall,
      canRaise:
        !player.allIn &&
        (player.stack ?? 0) > 0 &&
        !(this.state.raiseRestrictedSeatIndexes ?? []).includes(seatIndex),
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
      this.burnCard();
      this.state.boardCards = [...this.state.boardCards, ...this.drawCards(3)];
    } else if (nextStreet === "TURN" || nextStreet === "RIVER") {
      this.burnCard();
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
    this.state.lastFullRaiseSize = Math.max(1, this.blinds.bb ?? 2);
    this.state.raiseRestrictedSeatIndexes = [];
  }

  burnCard() {
    const [card] = this.drawCards(1);
    if (card) {
      this.burnedCards = [...this.burnedCards, card];
    }
    return card ?? null;
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
    const { payouts: allPayouts, potDetails } = resolveHighContributionPots({
      players: this.state.players,
      evaluations,
      compareEvaluations: compareNlhHands,
      totalPot: resolvedPot,
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
