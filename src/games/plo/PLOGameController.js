import NLHGameController from "../nlh/NLHGameController.js";
import PLOGameDefinition from "./PLOGameDefinition.js";
import { evaluatePloHand, comparePloHands } from "./utils/ploEvaluator.js";

export class PLOGameController extends NLHGameController {
  constructor(options = {}) {
    super({
      ...options,
      gameDefinition: options.gameDefinition ?? PLOGameDefinition,
    });
    this.holeCardCount = options.holeCardCount ?? 4;
  }

  dealHoleCards(players) {
    const activeSeats = players.filter((player) => !player.folded && !player.seatOut);
    for (let round = 0; round < this.holeCardCount; round += 1) {
      activeSeats.forEach((player) => {
        const [card] = this.drawCards(1);
        if (card) {
          player.holeCards = player.holeCards ? [...player.holeCards, card] : [card];
        }
      });
    }
  }

  getPotLimitMaxCommit(seatIndex) {
    const player = this.state.players[seatIndex];
    if (!player) return 0;
    const toCall = Math.max(0, (this.state.currentBet ?? 0) - (player.betThisStreet ?? 0));
    const potBeforeAction = this.calculatePot();
    if (toCall > 0) {
      return Math.max(0, potBeforeAction + 2 * toCall);
    }
    return Math.max(this.blinds.bb ?? 0, potBeforeAction);
  }

  applyPlayerAction({ seatIndex, action, amount = 0 } = {}) {
    const actionName = String(action ?? "").toLowerCase();
    if (actionName !== "bet" && actionName !== "raise") {
      return super.applyPlayerAction({ seatIndex, action, amount });
    }
    const player = this.state.players[seatIndex];
    if (!player) {
      return { success: false, reason: "Player not found" };
    }
    const maxCommit = Math.min(player.stack ?? 0, this.getPotLimitMaxCommit(seatIndex));
    const requested = amount > 0 ? amount : maxCommit;
    return super.applyPlayerAction({
      seatIndex,
      action,
      amount: Math.min(requested, maxCommit),
    });
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
    const evaluations = contenders.map((player) => ({
      player,
      evaluation: evaluatePloHand({
        holeCards: player.holeCards,
        boardCards: board,
      }),
    }));
    let best = null;
    evaluations.forEach((entry) => {
      if (!best || comparePloHands(entry.evaluation, best.evaluation) < 0) {
        best = entry;
      }
    });
    const winners = evaluations.filter(
      (entry) => comparePloHands(entry.evaluation, best.evaluation) === 0,
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

export default PLOGameController;
