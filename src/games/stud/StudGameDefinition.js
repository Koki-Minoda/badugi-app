import { createGameDefinition } from "../_core/GameDefinition.js";
import { DeckManager } from "../badugi/utils/deck.js";
import { evaluateHighHand } from "../evaluators/high.js";

const StudGameDefinition = createGameDefinition({
  id: "game-stud",
  label: "Stud",
  variant: "stud",
  maxPlayers: 8,
  streets: ["third", "fourth", "fifth", "sixth", "seventh", "showdown"],
  hasCommunityCards: false,
  handStructure: { hole: 7, up: 4, down: 3 },
  defaultBlinds: { sb: 1, bb: 2, ante: 1 },
  betting: { structure: "fixed-limit", bringIn: true, raiseCap: 4 },
  buildInitialState() {
    return { deck: new DeckManager() };
  },
  createDeck() {
    return new DeckManager();
  },
  evaluateHand: ({ cards = [] } = {}) => evaluateHighHand({ cards }),
});

export default StudGameDefinition;
export { StudGameDefinition };
