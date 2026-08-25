import { DeuceToSevenTripleDrawEngine } from "./DeuceToSevenTripleDrawEngine.js";

export class AceToFiveTripleDrawEngine extends DeuceToSevenTripleDrawEngine {
  constructor({ deckManager = null } = {}) {
    super({
      deckManager,
      gameId: "ace_to_five_triple_draw",
      displayName: "A-5 Triple Draw",
      variantId: "D02",
      evaluatorTag: "low-a5",
      lowType: "A5",
      cpuStrategy: "ruleBasedD02",
    });
    this.drawHeuristic.weakLateDrawRound = 3;
  }
}

export default AceToFiveTripleDrawEngine;
