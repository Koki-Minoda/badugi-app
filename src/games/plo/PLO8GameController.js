import { combinations } from "../evaluators/core.js";
import { evaluateLowHand } from "../evaluators/low.js";
import {
  applyPayoutsToPlayers,
  buildContributionPots,
  resolveEvaluationPot,
  summarizePayouts,
  splitAmountBySeatOrder,
} from "../core/sidePotResolver.js";
import PLOGameController from "./PLOGameController.js";
import PLO8GameDefinition from "./PLO8GameDefinition.js";
import { comparePloHands, evaluatePloHand } from "./utils/ploEvaluator.js";

function compareLowHands(aEval, bEval) {
  return (aEval?.rankPrimary ?? Number.POSITIVE_INFINITY) -
    (bEval?.rankPrimary ?? Number.POSITIVE_INFINITY);
}

export function evaluateOmahaEightLow({ holeCards = [], boardCards = [] } = {}) {
  let best = null;
  for (const holeCombo of combinations(holeCards, 2)) {
    for (const boardCombo of combinations(boardCards, 3)) {
      const evaluation = evaluateLowHand({
        cards: [...holeCombo, ...boardCombo],
        lowType: "A5",
        requireQualifier: 8,
      });
      if (evaluation?.qualifies && (!best || compareLowHands(evaluation, best) < 0)) {
        best = {
          ...evaluation,
          evaluator: "omahaEightLow",
          holeCardsUsed: [...holeCombo],
          boardCardsUsed: [...boardCombo],
        };
      }
    }
  }
  return best;
}

export class PLO8GameController extends PLOGameController {
  constructor(options = {}) {
    super({
      ...options,
      gameDefinition: options.gameDefinition ?? PLO8GameDefinition,
    });
  }

  resolveShowdown({ totalPot = null } = {}) {
    if (this.state.street !== "SHOWDOWN") {
      this.state.street = "SHOWDOWN";
    }
    const board = [...this.state.boardCards];
    const contenders = this.state.players.filter(
      (player) =>
        player &&
        !player.folded &&
        !player.seatOut &&
        Array.isArray(player.holeCards) &&
        player.holeCards.length >= this.holeCardCount,
    );
    const highEvaluations = contenders.map((player) => ({
      player,
      evaluation: evaluatePloHand({ holeCards: player.holeCards, boardCards: board }),
    }));
    const lowEvaluations = contenders
      .map((player) => ({
        player,
        evaluation: evaluateOmahaEightLow({ holeCards: player.holeCards, boardCards: board }),
      }))
      .filter((entry) => entry.evaluation?.qualifies);
    const resolvedPot = totalPot ?? this.calculatePot();
    const contributionPots = buildContributionPots(this.state.players);
    const potsToResolve = contributionPots.length
      ? contributionPots
      : [{ potIndex: 0, amount: resolvedPot, potAmount: resolvedPot, eligibleSeatIndexes: contenders.map((p) => p.seatIndex) }];
    const allPayouts = [];
    const potDetails = potsToResolve.map((pot, potIndex) => {
      const eligibleLow = lowEvaluations.filter((entry) =>
        (pot.eligibleSeatIndexes ?? []).includes(entry.player.seatIndex),
      );
      const highAmount = eligibleLow.length ? Math.ceil(pot.amount / 2) : pot.amount;
      const lowAmount = eligibleLow.length ? pot.amount - highAmount : 0;
      const highPayouts = resolveEvaluationPot({
        amount: highAmount,
        eligibleSeatIndexes: pot.eligibleSeatIndexes,
        evaluations: highEvaluations,
        compareEvaluations: comparePloHands,
      });
      const lowBest = eligibleLow.reduce(
        (best, entry) => (!best || compareLowHands(entry.evaluation, best.evaluation) < 0 ? entry : best),
        null,
      );
      const lowWinners = lowBest
        ? eligibleLow.filter((entry) => compareLowHands(entry.evaluation, lowBest.evaluation) === 0)
        : [];
      const lowPayouts = splitAmountBySeatOrder(lowAmount, lowWinners);
      allPayouts.push(...highPayouts, ...lowPayouts);
      return {
        potIndex: pot.potIndex ?? potIndex,
        amount: pot.amount,
        potAmount: pot.amount,
        eligibleSeatIndexes: [...(pot.eligibleSeatIndexes ?? [])],
        highWinners: highPayouts.map((winner) => ({
          seatIndex: winner.player.seatIndex,
          name: winner.player.name,
          payout: winner.payout,
          evaluation: winner.evaluation,
        })),
        lowWinners: lowPayouts.map((winner) => ({
          seatIndex: winner.player.seatIndex,
          name: winner.player.name,
          payout: winner.payout,
          evaluation: winner.evaluation,
        })),
      };
    });
    applyPayoutsToPlayers(this.state.players, allPayouts);
    const summary = {
      handId: this.state.handId,
      board,
      totalPot: resolvedPot,
      winners: summarizePayouts(allPayouts),
      potDetails,
      splitMode: "hiLo",
    };
    this.state.lastHandResult = summary;
    return summary;
  }
}

export default PLO8GameController;
