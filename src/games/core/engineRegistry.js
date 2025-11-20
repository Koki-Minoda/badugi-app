import { BadugiEngine } from "../badugi/engine/BadugiEngine.js";

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
