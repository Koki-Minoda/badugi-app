import { DeuceToSevenTripleDrawEngine } from "./DeuceToSevenTripleDrawEngine.js";

export class AceToFiveSingleDrawEngine extends DeuceToSevenTripleDrawEngine {
  constructor({ deckManager = null } = {}) {
    super({
      deckManager,
      gameId: "ace_to_five_single_draw",
      displayName: "A-5 Single Draw",
      variantId: "S02",
      evaluatorTag: "low-a5",
      lowType: "A5",
      cpuStrategy: "ruleBasedS02",
      maxDrawRounds: 1,
      bigBetStartsAtDrawRound: 1,
    });
  }
}

export default AceToFiveSingleDrawEngine;
