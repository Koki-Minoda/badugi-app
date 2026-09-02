import PLO8GameController from "./PLO8GameController.js";
import BigOGameDefinition from "./BigOGameDefinition.js";

export class BigOGameController extends PLO8GameController {
  constructor(options = {}) {
    super({
      ...options,
      holeCardCount: 5,
      gameDefinition: options.gameDefinition ?? BigOGameDefinition,
    });
  }
}

export default BigOGameController;
