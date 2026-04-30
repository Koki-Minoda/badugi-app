import { DeuceToSevenTripleDrawController } from "./DeuceToSevenTripleDrawController.js";
import { DeuceToSevenSingleDrawEngine } from "./DeuceToSevenSingleDrawEngine.js";

export class DeuceToSevenSingleDrawController extends DeuceToSevenTripleDrawController {
  constructor({ engine = null, tableConfig = {} } = {}) {
    super({
      engine: engine ?? new DeuceToSevenSingleDrawEngine(),
      tableConfig,
    });
  }
}

export default DeuceToSevenSingleDrawController;
