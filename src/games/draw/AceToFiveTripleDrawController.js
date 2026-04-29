import { DeuceToSevenTripleDrawController } from "./DeuceToSevenTripleDrawController.js";
import { AceToFiveTripleDrawEngine } from "./AceToFiveTripleDrawEngine.js";

export class AceToFiveTripleDrawController extends DeuceToSevenTripleDrawController {
  constructor({ engine = null, tableConfig = {} } = {}) {
    super({
      engine: engine ?? new AceToFiveTripleDrawEngine(),
      tableConfig,
    });
  }
}

export default AceToFiveTripleDrawController;
