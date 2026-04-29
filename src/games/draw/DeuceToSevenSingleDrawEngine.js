import { DeuceToSevenTripleDrawEngine } from "./DeuceToSevenTripleDrawEngine.js";

export class DeuceToSevenSingleDrawEngine extends DeuceToSevenTripleDrawEngine {
  constructor({ deckManager = null } = {}) {
    super({
      deckManager,
      gameId: "deuce_to_seven_single_draw",
      displayName: "2-7 Single Draw",
      variantId: "S01",
      evaluatorTag: "low-27",
      lowType: "27",
      cpuStrategy: "ruleBasedS01",
      maxDrawRounds: 1,
      bigBetStartsAtDrawRound: 1,
    });
  }
}

export default DeuceToSevenSingleDrawEngine;
