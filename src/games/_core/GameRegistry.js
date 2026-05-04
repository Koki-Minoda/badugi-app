import BadugiGameDefinition from "../badugi/BadugiGameDefinition";
import { DRAMAHA_DEFINITIONS } from "../dramaha/DramahaVariants.js";
import FLHGameDefinition from "../nlh/FLHGameDefinition.js";
import NLHGameDefinition from "../nlh/NLHGameDefinition.js";
import BigOGameDefinition from "../plo/BigOGameDefinition.js";
import FiveCardPLOGameDefinition from "../plo/FiveCardPLOGameDefinition.js";
import FLO8GameDefinition from "../plo/FLO8GameDefinition.js";
import PLO8GameDefinition from "../plo/PLO8GameDefinition.js";
import PLOGameDefinition from "../plo/PLOGameDefinition.js";
import Razz27GameDefinition from "../stud/Razz27GameDefinition.js";
import RazzGameDefinition from "../stud/RazzGameDefinition.js";
import RazzduceyGameDefinition from "../stud/RazzduceyGameDefinition.js";
import RazzdugiGameDefinition from "../stud/RazzdugiGameDefinition.js";
import Stud8GameDefinition from "../stud/Stud8GameDefinition.js";
import StudGameDefinition from "../stud/StudGameDefinition.js";

class GameRegistryClass {
  constructor() {
    this.definitions = new Map();
  }

  register(definition) {
    if (!definition || !definition.id) {
      throw new Error("Cannot register game definition without id");
    }
    this.definitions.set(definition.id, definition);
    if (definition.variant && !this.definitions.has(definition.variant)) {
      // Allow lookups by logical variant name as well.
      this.definitions.set(definition.variant, definition);
    }
  }

  get(id) {
    return this.definitions.get(id) ?? null;
  }

  list() {
    return Array.from(
      new Set(
        Array.from(this.definitions.values(), (definition) => definition),
      ),
    );
  }
}

const registry = new GameRegistryClass();
registry.register(BadugiGameDefinition);
registry.register(NLHGameDefinition);
registry.register(FLHGameDefinition);
registry.register(PLOGameDefinition);
registry.register(PLO8GameDefinition);
registry.register(BigOGameDefinition);
registry.register(FiveCardPLOGameDefinition);
registry.register(FLO8GameDefinition);
registry.register(StudGameDefinition);
registry.register(Stud8GameDefinition);
registry.register(RazzGameDefinition);
registry.register(Razz27GameDefinition);
registry.register(RazzdugiGameDefinition);
registry.register(RazzduceyGameDefinition);
Object.values(DRAMAHA_DEFINITIONS).forEach((definition) => registry.register(definition));

export default registry;
