import { DeuceToSevenTripleDrawController } from "./DeuceToSevenTripleDrawController.js";
import {
  ArchieTripleDrawEngine,
  BadaceySingleDrawEngine,
  BadaceyTripleDrawEngine,
  BadeuceySingleDrawEngine,
  BadeuceyTripleDrawEngine,
  BadugiSingleDrawEngine,
  HidugiSingleDrawEngine,
  HidugiTripleDrawEngine,
} from "./SpecialDrawEngine.js";

function makeController(EngineClass) {
  return class extends DeuceToSevenTripleDrawController {
    constructor({ engine = null, tableConfig = {} } = {}) {
      super({ engine: engine ?? new EngineClass(), tableConfig });
    }
  };
}

export const BadeuceyTripleDrawController = makeController(BadeuceyTripleDrawEngine);
export const BadaceyTripleDrawController = makeController(BadaceyTripleDrawEngine);
export const HidugiTripleDrawController = makeController(HidugiTripleDrawEngine);
export const ArchieTripleDrawController = makeController(ArchieTripleDrawEngine);
export const BadugiSingleDrawController = makeController(BadugiSingleDrawEngine);
export const BadeuceySingleDrawController = makeController(BadeuceySingleDrawEngine);
export const BadaceySingleDrawController = makeController(BadaceySingleDrawEngine);
export const HidugiSingleDrawController = makeController(HidugiSingleDrawEngine);

export default {
  BadeuceyTripleDrawController,
  BadaceyTripleDrawController,
  HidugiTripleDrawController,
  ArchieTripleDrawController,
  BadugiSingleDrawController,
  BadeuceySingleDrawController,
  BadaceySingleDrawController,
  HidugiSingleDrawController,
};
