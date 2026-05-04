import { FLHGameController } from "./FLHGameController.js";
import { NLHGameController } from "./NLHGameController.js";
import FLSuperHoldemGameDefinition from "./FLSuperHoldemGameDefinition.js";
import SuperHoldemGameDefinition from "./SuperHoldemGameDefinition.js";

export class SuperHoldemGameController extends NLHGameController {
  constructor(options = {}) {
    super({
      ...options,
      gameDefinition: options.gameDefinition ?? SuperHoldemGameDefinition,
    });
  }
}

export class FLSuperHoldemGameController extends FLHGameController {
  constructor(options = {}) {
    super({
      ...options,
      gameDefinition: options.gameDefinition ?? FLSuperHoldemGameDefinition,
    });
  }
}

export default SuperHoldemGameController;
