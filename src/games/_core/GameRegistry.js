import BadugiGameDefinition from "../badugi/BadugiGameDefinition";
import NLHGameDefinition from "../nlh/NLHGameDefinition.js";

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

export default registry;
