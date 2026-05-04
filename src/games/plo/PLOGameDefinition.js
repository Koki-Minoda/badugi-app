import { createGameDefinition } from "../_core/GameDefinition.js";
import { DeckManager } from "../badugi/utils/deck.js";
import { evaluatePloHand, comparePloHands } from "./utils/ploEvaluator.js";

const PLOGameDefinition = createGameDefinition({
  id: "game-plo",
  label: "Pot-Limit Omaha",
  variant: "plo",
  maxPlayers: 9,
  streets: ["preflop", "flop", "turn", "river", "showdown"],
  hasCommunityCards: true,
  handStructure: { hole: 4, community: 5, mustUseHole: 2, mustUseBoard: 3 },
  defaultBlinds: { sb: 1, bb: 2 },
  betting: { structure: "potLimit" },
  buildInitialState() {
    return {
      deck: new DeckManager(),
    };
  },
  createDeck() {
    return new DeckManager();
  },
  evaluateHand: evaluatePloHand,
  compareHands: comparePloHands,
  getWinners(entries = []) {
    const valid = entries.filter((entry) => entry?.evaluation);
    if (!valid.length) return [];
    const bestEval = valid.reduce((best, entry) => {
      if (!best) return entry;
      return comparePloHands(entry.evaluation, best.evaluation) < 0 ? entry : best;
    }, null);
    return valid.filter(
      (entry) => comparePloHands(entry.evaluation, bestEval.evaluation) === 0,
    );
  },
  runShowdown() {
    return { summary: [], winners: [] };
  },
});

export default PLOGameDefinition;
export { PLOGameDefinition };
