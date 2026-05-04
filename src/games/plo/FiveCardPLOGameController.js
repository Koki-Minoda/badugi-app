import PLOGameController from "./PLOGameController.js";
import FiveCardPLOGameDefinition from "./FiveCardPLOGameDefinition.js";

export class FiveCardPLOGameController extends PLOGameController {
  constructor(options = {}) {
    super({
      ...options,
      holeCardCount: 5,
      gameDefinition: options.gameDefinition ?? FiveCardPLOGameDefinition,
    });
  }
}

export default FiveCardPLOGameController;
