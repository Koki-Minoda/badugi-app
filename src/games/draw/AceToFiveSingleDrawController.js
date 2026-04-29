import { DeuceToSevenTripleDrawController } from "./DeuceToSevenTripleDrawController.js";
import { AceToFiveSingleDrawEngine } from "./AceToFiveSingleDrawEngine.js";

export class AceToFiveSingleDrawController extends DeuceToSevenTripleDrawController {
  constructor({ engine = null, tableConfig = {} } = {}) {
    super({
      engine: engine ?? new AceToFiveSingleDrawEngine(),
      tableConfig,
    });
  }
}

export default AceToFiveSingleDrawController;
