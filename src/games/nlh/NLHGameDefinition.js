// src/games/nlh/NLHGameDefinition.js

import { createGameDefinition } from "../_core/GameDefinition.js";
import { DeckManager } from "../badugi/utils/deck.js";
import { evaluateNlhHand, compareNlhHands } from "./utils/nlhEvaluator.js";

function runEvaluation(input) {
  if (Array.isArray(input)) {
    return evaluateNlhHand({ cards: input });
  }
  return evaluateNlhHand(input);
}

const NLHGameDefinition = createGameDefinition({
  id: "game-nlh",
  label: "No-Limit Hold'em",
  variant: "nlh",
  maxPlayers: 9,
  streets: ["preflop", "flop", "turn", "river", "showdown"],
  hasCommunityCards: true,
  handStructure: { hole: 2, community: 5 },
  defaultBlinds: { sb: 1, bb: 2 },
  buildInitialState() {
    return {
      deck: new DeckManager(),
    };
  },
  createDeck() {
    return new DeckManager();
  },
  evaluateHand: runEvaluation,
  compareHands: compareNlhHands,
  getWinners(entries = []) {
    if (!Array.isArray(entries) || entries.length === 0) return [];
    const hydrated = entries.map((entry) => {
      if (entry.evaluation) return entry;
      const cards = entry.cards ?? entry.hand ?? [];
      return {
        ...entry,
        evaluation: Array.isArray(cards) ? runEvaluation(cards) : null,
      };
    });
    const valid = hydrated.filter((entry) => entry.evaluation);
    if (!valid.length) return [];
    const bestEval = valid.reduce((best, entry) => {
      if (!best) return entry;
      return compareNlhHands(entry.evaluation, best.evaluation) < 0 ? entry : best;
    }, null);
    return valid.filter(
      (entry) => compareNlhHands(entry.evaluation, bestEval.evaluation) === 0,
    );
  },
  runShowdown() {
    return { summary: [], winners: [] };
  },
});

export default NLHGameDefinition;
export { NLHGameDefinition };
