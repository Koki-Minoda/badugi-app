import { DeuceToSevenTripleDrawController } from "./DeuceToSevenTripleDrawController.js";
import { FiveCardSingleDrawEngine } from "./FiveCardSingleDrawEngine.js";

export class FiveCardSingleDrawController extends DeuceToSevenTripleDrawController {
  constructor({ engine = null, tableConfig = {} } = {}) {
    super({
      engine: engine ?? new FiveCardSingleDrawEngine(),
      tableConfig,
    });
  }
}

export default FiveCardSingleDrawController;
