import { createGameDefinition } from "../_core/GameDefinition";
import { DeckManager } from "./utils/deck";
import { evaluateBadugi, compareBadugi, getWinnersByBadugi } from "./utils/badugiEvaluator";
import { runShowdown } from "./engine/showdown";

const BadugiGameDefinition = createGameDefinition({
  id: "game-badugi",
  label: "Badugi",
  variant: "badugi",
  maxPlayers: 6,
  streets: ["bet", "draw1", "draw2", "draw3", "showdown"],
  hasCommunityCards: false,
  handStructure: { hole: 4, community: 0 },
  defaultBlinds: { sb: 5, bb: 10 },
  buildInitialState() {
    return {
      deck: new DeckManager(),
    };
  },
  createDeck() {
    return new DeckManager();
  },
  evaluateHand: evaluateBadugi,
  compareHands: compareBadugi,
  getWinners: getWinnersByBadugi,
  runShowdown,
});

export default BadugiGameDefinition;
