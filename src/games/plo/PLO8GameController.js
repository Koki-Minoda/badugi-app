import { combinations } from "../evaluators/core.js";
import { evaluateLowHand } from "../evaluators/low.js";
import {
  applyPayoutsToPlayers,
  resolveHiLoContributionPots,
  summarizePayouts,
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
    const { payouts: allPayouts, potDetails } = resolveHiLoContributionPots({
      players: this.state.players,
      highEvaluations,
      lowEvaluations,
      compareHighEvaluations: comparePloHands,
      compareLowEvaluations: compareLowHands,
      totalPot: resolvedPot,
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
