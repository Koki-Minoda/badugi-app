import { evaluateHighHand } from "../evaluators/high.js";
import { evaluateLowHand } from "../evaluators/low.js";
import { DeckManager } from "../badugi/utils/deck.js";
import { applyChips } from "../core/applyChips.js";
import {
  applyPayoutsToPlayers,
  buildContributionPots,
  resolveEvaluationPot,
  summarizePayouts,
  splitAmountBySeatOrder,
} from "../core/sidePotResolver.js";
import StudGameDefinition from "./StudGameDefinition.js";
import Stud8GameDefinition from "./Stud8GameDefinition.js";
import RazzGameDefinition from "./RazzGameDefinition.js";

function clonePlayer(player) {
  if (!player) return player;
  return {
    ...player,
    holeCards: Array.isArray(player.holeCards) ? [...player.holeCards] : [],
    upCards: Array.isArray(player.upCards) ? [...player.upCards] : [],
    downCards: Array.isArray(player.downCards) ? [...player.downCards] : [],
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
    upCards: [],
    downCards: [],
  };
}

function compareEval(aEval, bEval) {
  return (aEval?.rankPrimary ?? Number.POSITIVE_INFINITY) -
    (bEval?.rankPrimary ?? Number.POSITIVE_INFINITY);
}

function defaultTableConfig() {
  return {
    seats: [],
    blinds: { sb: 1, bb: 2, ante: 1 },
  };
}

export class StudGameController {
  constructor({
    tableConfig = defaultTableConfig(),
    gameDefinition = StudGameDefinition,
    variant = "stud",
    deckFactory = () => new DeckManager(),
  } = {}) {
    this.config = { tableConfig, gameDefinition, deckFactory };
    this.variant = variant;
    this.handCounter = 0;
    this.raiseCap = 4;
    this.raiseCountThisStreet = 0;
    this.deck = null;
    this.state = {
      players: (tableConfig?.seats ?? []).map(buildPlayerFromSeat),
      street: "IDLE",
      currentActor: null,
      pot: 0,
      currentBet: 0,
      dealerIndex: -1,
      handId: null,
      lastHandResult: null,
    };
  }

  updateTableConfig(tableConfig = {}) {
    this.config.tableConfig = { ...(this.config.tableConfig ?? {}), ...tableConfig };
  }

  syncExternalState(partial = {}) {
    if (partial.players) {
      this.state.players = partial.players.map(clonePlayer);
    }
    this.state = { ...this.state, ...partial };
  }

  get blinds() {
    const blinds = this.config.tableConfig?.blinds ?? {};
    return {
      sb: blinds.sb ?? 1,
      bb: blinds.bb ?? 2,
      ante: blinds.ante ?? 1,
    };
  }

  getSnapshot() {
    return {
      ...this.state,
      phase: this.state.street === "SHOWDOWN" ? "SHOWDOWN" : "BET",
      turn: this.state.currentActor,
      nextTurn: this.state.currentActor,
      players: this.state.players.map(clonePlayer),
      boardCards: [],
      pots: [{ amount: this.calculatePot(), potAmount: this.calculatePot() }],
    };
  }

  resetDeck() {
    this.deck = this.config.deckFactory();
    if (typeof this.deck.reset === "function") this.deck.reset();
  }

  drawCards(count) {
    if (!this.deck) this.resetDeck();
    if (typeof this.deck.draw === "function") return this.deck.draw(count);
    return this.deck.cards.splice(0, count);
  }

  startNewHand({ handId = null } = {}) {
    if (!this.state.players.length) {
      this.state.players = (this.config.tableConfig?.seats ?? []).map(buildPlayerFromSeat);
    }
    this.handCounter += 1;
    this.state.handId = handId ?? `${this.variant}-hand-${this.handCounter}`;
    this.resetDeck();
    this.raiseCountThisStreet = 0;
    const players = this.state.players.map((player) => ({
      ...player,
      betThisStreet: 0,
      folded: player.stack <= 0 || player.seatOut,
      allIn: player.stack <= 0,
      hasActedThisStreet: false,
      lastAction: "",
      holeCards: [],
      upCards: [],
      downCards: [],
    }));
    players.forEach((player) => {
      if (!player.folded && !player.seatOut) this.commitChips(player, this.blinds.ante);
    });
    players.forEach((player) => {
      player.betThisStreet = 0;
      player.hasActedThisStreet = false;
    });
    this.dealStudCards(players);
    this.state.players = players;
    this.state.street = "THIRD";
    this.state.currentBet = 0;
    this.state.dealerIndex = this.nextOccupiedSeat(this.state.dealerIndex, { players, allowSame: false }) ?? 0;
    this.state.currentActor = this.nextActiveSeat(this.state.dealerIndex, players);
    this.state.pot = this.calculatePot(players);
    return this.getSnapshot();
  }

  dealStudCards(players) {
    const active = players.filter((player) => !player.folded && !player.seatOut);
    for (let round = 0; round < 7; round += 1) {
      active.forEach((player) => {
        const [card] = this.drawCards(1);
        if (!card) return;
        player.holeCards.push(card);
        if (round < 2 || round === 6) player.downCards.push(card);
        else player.upCards.push(card);
      });
    }
  }

  commitChips(player, amount) {
    const applied = applyChips(player, amount);
    player.betThisStreet = (player.betThisStreet ?? 0) + applied;
    if (player.stack === 0) player.allIn = true;
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
      if (player && !player.seatOut && !player.isBusted && player.stack > 0) return idx;
    }
    return null;
  }

  nextActiveSeat(fromIndex, players = this.state.players) {
    if (!players.length) return null;
    for (let i = 1; i <= players.length; i += 1) {
      const idx = (fromIndex + i) % players.length;
      const player = players[idx];
      if (!player || player.seatOut || player.folded || player.allIn || player.stack <= 0) continue;
      return idx;
    }
    return null;
  }

  getLimitUnit() {
    const bb = this.blinds.bb ?? 2;
    return this.state.street === "FIFTH" || this.state.street === "SIXTH" || this.state.street === "SEVENTH"
      ? bb * 2
      : bb;
  }

  applyPlayerAction({ seatIndex, action, amount = 0 } = {}) {
    const player = this.state.players[seatIndex];
    if (!player) return { success: false, reason: "Player not found" };
    if (player.folded || player.seatOut || player.allIn) return { success: false, reason: "Player cannot act" };
    const actionName = String(action ?? "").toLowerCase();
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
        if (actionName !== "all-in" && this.raiseCountThisStreet >= this.raiseCap) {
          return this.applyPlayerAction({ seatIndex, action: "call" });
        }
        const toCall = Math.max(0, this.state.currentBet - (player.betThisStreet ?? 0));
        const unit = actionName === "all-in" ? player.stack : (amount > 0 ? amount : this.getLimitUnit());
        this.commitChips(player, Math.min(player.stack, toCall + unit));
        this.state.currentBet = Math.max(this.state.currentBet, player.betThisStreet ?? 0);
        if (actionName !== "all-in") this.raiseCountThisStreet += 1;
        player.lastAction = actionName === "all-in" ? "All-in" : actionName === "raise" ? "Raise" : "Bet";
        break;
      }
      default:
        return { success: false, reason: "Unsupported action" };
    }
    player.hasActedThisStreet = true;
    this.state.players[seatIndex] = { ...player };
    this.state.pot = this.calculatePot();
    const contenders = this.state.players.filter((p) => p && !p.folded && !p.seatOut);
    if (contenders.length <= 1) {
      this.resolveUncontested();
    } else if (this.isBettingRoundComplete()) {
      this.advanceStreet();
    } else {
      this.state.currentActor = this.nextActiveSeat(seatIndex);
    }
    return { success: true, player: clonePlayer(player) };
  }

  isBettingRoundComplete() {
    const active = this.state.players.filter((player) => player && !player.folded && !player.seatOut && !player.allIn);
    if (!active.length) return true;
    return active.every(
      (player) => player.hasActedThisStreet && (player.betThisStreet ?? 0) === (this.state.currentBet ?? 0),
    );
  }

  getNextStreet(street) {
    switch (street) {
      case "THIRD":
        return "FOURTH";
      case "FOURTH":
        return "FIFTH";
      case "FIFTH":
        return "SIXTH";
      case "SIXTH":
        return "SEVENTH";
      case "SEVENTH":
        return "SHOWDOWN";
      default:
        return "THIRD";
    }
  }

  resetStreetBets() {
    this.raiseCountThisStreet = 0;
    this.state.players = this.state.players.map((player) => ({
      ...player,
      betThisStreet: 0,
      hasActedThisStreet: false,
    }));
    this.state.currentBet = 0;
  }

  advanceStreet() {
    const nextStreet = this.getNextStreet(this.state.street);
    this.resetStreetBets();
    this.state.street = nextStreet;
    this.state.currentActor = nextStreet === "SHOWDOWN" ? null : this.nextActiveSeat(this.state.dealerIndex);
    if (nextStreet === "SHOWDOWN") this.resolveShowdown();
    return this.getSnapshot();
  }

  evaluatePlayer(player) {
    if (this.variant === "razz") {
      return evaluateLowHand({ cards: player.holeCards, lowType: "A5" });
    }
    return evaluateHighHand({ cards: player.holeCards });
  }

  resolveShowdown({ totalPot = null } = {}) {
    this.state.street = "SHOWDOWN";
    const contenders = this.state.players.filter(
      (player) => player && !player.folded && !player.seatOut && player.holeCards?.length >= 5,
    );
    const highEvaluations = contenders.map((player) => ({
      player,
      evaluation: evaluateHighHand({ cards: player.holeCards }),
    }));
    const lowEvaluations = contenders.map((player) => ({
      player,
      evaluation: evaluateLowHand({
        cards: player.holeCards,
        lowType: "A5",
        requireQualifier: this.variant === "stud8" ? 8 : null,
      }),
    })).filter((entry) => this.variant !== "stud8" || entry.evaluation?.qualifies);
    const singleEvaluations = this.variant === "razz" ? lowEvaluations : highEvaluations;
    const resolvedPot = totalPot ?? this.calculatePot();
    const contributionPots = buildContributionPots(this.state.players);
    const potsToResolve = contributionPots.length
      ? contributionPots
      : [{ potIndex: 0, amount: resolvedPot, eligibleSeatIndexes: contenders.map((p) => p.seatIndex) }];
    const allPayouts = [];
    const potDetails = potsToResolve.map((pot, potIndex) => {
      if (this.variant === "stud8") {
        const eligibleLow = lowEvaluations.filter((entry) =>
          (pot.eligibleSeatIndexes ?? []).includes(entry.player.seatIndex),
        );
        const highAmount = eligibleLow.length ? Math.ceil(pot.amount / 2) : pot.amount;
        const lowAmount = eligibleLow.length ? pot.amount - highAmount : 0;
        const highPayouts = resolveEvaluationPot({
          amount: highAmount,
          eligibleSeatIndexes: pot.eligibleSeatIndexes,
          evaluations: highEvaluations,
          compareEvaluations: compareEval,
        });
        const lowBest = eligibleLow.reduce(
          (best, entry) => (!best || compareEval(entry.evaluation, best.evaluation) < 0 ? entry : best),
          null,
        );
        const lowPayouts = lowBest
          ? splitAmountBySeatOrder(lowAmount, eligibleLow.filter((entry) => compareEval(entry.evaluation, lowBest.evaluation) === 0))
          : [];
        allPayouts.push(...highPayouts, ...lowPayouts);
        return {
          potIndex: pot.potIndex ?? potIndex,
          amount: pot.amount,
          highWinners: highPayouts.map((winner) => ({ seatIndex: winner.player.seatIndex, payout: winner.payout, evaluation: winner.evaluation })),
          lowWinners: lowPayouts.map((winner) => ({ seatIndex: winner.player.seatIndex, payout: winner.payout, evaluation: winner.evaluation })),
        };
      }
      const payouts = resolveEvaluationPot({
        amount: pot.amount,
        eligibleSeatIndexes: pot.eligibleSeatIndexes,
        evaluations: singleEvaluations,
        compareEvaluations: compareEval,
      });
      allPayouts.push(...payouts);
      return {
        potIndex: pot.potIndex ?? potIndex,
        amount: pot.amount,
        winners: payouts.map((winner) => ({ seatIndex: winner.player.seatIndex, payout: winner.payout, evaluation: winner.evaluation })),
      };
    });
    applyPayoutsToPlayers(this.state.players, allPayouts);
    this.state.lastHandResult = {
      handId: this.state.handId,
      board: [],
      totalPot: resolvedPot,
      winners: summarizePayouts(allPayouts),
      potDetails,
      splitMode: this.variant === "stud8" ? "hiLo" : "single",
    };
    return this.state.lastHandResult;
  }

  resolveUncontested() {
    const winner = this.state.players.find((player) => player && !player.folded && !player.seatOut);
    const pot = this.calculatePot();
    if (winner) winner.stack += pot;
    this.state.street = "SHOWDOWN";
    this.state.currentActor = null;
    this.state.lastHandResult = {
      handId: this.state.handId,
      board: [],
      totalPot: pot,
      winners: winner ? [{ seatIndex: winner.seatIndex, name: winner.name, payout: pot, evaluation: null }] : [],
      potDetails: [{ potIndex: 0, amount: pot, winnerSeatIndexes: winner ? [winner.seatIndex] : [] }],
    };
    return this.state.lastHandResult;
  }
}

export class Stud8GameController extends StudGameController {
  constructor(options = {}) {
    super({ ...options, gameDefinition: options.gameDefinition ?? Stud8GameDefinition, variant: "stud8" });
  }
}

export class RazzGameController extends StudGameController {
  constructor(options = {}) {
    super({ ...options, gameDefinition: options.gameDefinition ?? RazzGameDefinition, variant: "razz" });
  }
}

export default StudGameController;
