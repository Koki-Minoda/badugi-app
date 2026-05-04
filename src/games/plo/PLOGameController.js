import NLHGameController from "../nlh/NLHGameController.js";
import PLOGameDefinition from "./PLOGameDefinition.js";
import { evaluatePloHand, comparePloHands } from "./utils/ploEvaluator.js";
import { estimateBoardHandStrength } from "../core/cpuTeacherPolicy.js";
import {
  applyPayoutsToPlayers,
  buildContributionPots,
  resolveEvaluationPot,
  summarizePayouts,
} from "../core/sidePotResolver.js";

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

  evaluateCpuStrength(player) {
    const board = [...(this.state.boardCards ?? [])];
    let evaluation = null;
    if (board.length >= 3 && Array.isArray(player?.holeCards) && player.holeCards.length >= this.holeCardCount) {
      try {
        evaluation = evaluatePloHand({ holeCards: player.holeCards, boardCards: board });
      } catch {
        evaluation = null;
      }
    }
    return estimateBoardHandStrength({
      holeCards: player?.holeCards ?? [],
      boardCards: board,
      evaluation,
      variantId: this.config.gameDefinition?.id ?? "B05",
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
      (entry) => comparePloHands(entry.evaluation, best.evaluation) === 0,
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
        compareEvaluations: comparePloHands,
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
}

export default PLOGameController;
