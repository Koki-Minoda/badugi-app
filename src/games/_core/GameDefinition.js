/**
 * Base factory for describing a card game's runtime hooks. This is intentionally
 * lightweight – it simply captures the provided configuration object and
 * exposes it as a plain definition bag. Individual games can decide how many
 * helpers they provide (deck creation, evaluation, UI adapters, etc).
 */
export function createGameDefinition(config = {}) {
  if (!config.id) {
    throw new Error("GameDefinition requires an id");
  }
  if (!config.label) {
    throw new Error(`GameDefinition "${config.id}" requires a label`);
  }
  if (!config.variant) {
    throw new Error(`GameDefinition "${config.id}" requires a variant`);
  }

  return {
    streets: [],
    hasCommunityCards: false,
    handStructure: { hole: 0, community: 0 },
    defaultBlinds: { sb: 0, bb: 0 },
    ...config,
  };
}

/**
 * Minimal shared flow controller placeholder. As additional variants come
 * online this will encapsulate more behavior, but for now it simply stores a
 * reference to the owning game definition.
 */
export class GameFlowController {
  constructor(definition) {
    this.definition = definition;
  }
}

/**
 * Minimal UI adapter placeholder for future multi-game rendering. Individual
 * variants can extend this to override per-game visuals.
 */
export class GameUIAdapter {
  constructor(definition) {
    this.definition = definition;
  }
}
