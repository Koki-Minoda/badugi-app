import { BadugiEngine } from "../badugi/engine/BadugiEngine.js";
import { AceToFiveSingleDrawEngine } from "../draw/AceToFiveSingleDrawEngine.js";
import { AceToFiveTripleDrawEngine } from "../draw/AceToFiveTripleDrawEngine.js";
import { DeuceToSevenSingleDrawEngine } from "../draw/DeuceToSevenSingleDrawEngine.js";
import { DeuceToSevenTripleDrawEngine } from "../draw/DeuceToSevenTripleDrawEngine.js";

const registry = new Map();

export function registerEngine(gameId, factory) {
  if (!gameId || typeof factory !== "function") {
    throw new Error("registerEngine requires gameId and factory function");
  }
  registry.set(gameId, factory);
}

export function getEngine(gameId) {
  const factory = registry.get(gameId);
  if (!factory) {
    throw new Error(`Engine not registered for id=${gameId}`);
  }
  return factory();
}

export function listEngines() {
  return Array.from(registry.keys());
}

// Pre-register Badugi engine factory (logic migrating in Spec09)
registerEngine("badugi", () => new BadugiEngine());
registerEngine("deuce_to_seven_triple_draw", () => new DeuceToSevenTripleDrawEngine());
registerEngine("ace_to_five_triple_draw", () => new AceToFiveTripleDrawEngine());
registerEngine("deuce_to_seven_single_draw", () => new DeuceToSevenSingleDrawEngine());
registerEngine("ace_to_five_single_draw", () => new AceToFiveSingleDrawEngine());
