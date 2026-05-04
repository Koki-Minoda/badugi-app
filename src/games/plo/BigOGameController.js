import FiveCardPLOGameController from "./FiveCardPLOGameController.js";
import BigOGameDefinition from "./BigOGameDefinition.js";

export class BigOGameController extends FiveCardPLOGameController {
  constructor(options = {}) {
    super({
      ...options,
      gameDefinition: options.gameDefinition ?? BigOGameDefinition,
    });
  }
}

export default BigOGameController;
