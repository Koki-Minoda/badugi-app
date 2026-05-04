import { BadugiEngine } from "../badugi/engine/BadugiEngine.js";
import { AceToFiveSingleDrawEngine } from "../draw/AceToFiveSingleDrawEngine.js";
import { AceToFiveTripleDrawEngine } from "../draw/AceToFiveTripleDrawEngine.js";
import { DeuceToSevenSingleDrawEngine } from "../draw/DeuceToSevenSingleDrawEngine.js";
import { DeuceToSevenTripleDrawEngine } from "../draw/DeuceToSevenTripleDrawEngine.js";
import { FiveCardSingleDrawEngine } from "../draw/FiveCardSingleDrawEngine.js";
import {
  ArchieTripleDrawEngine,
  BadaceySingleDrawEngine,
  BadaceyTripleDrawEngine,
  BadeuceySingleDrawEngine,
  BadeuceyTripleDrawEngine,
  BadugiSingleDrawEngine,
  HidugiSingleDrawEngine,
  HidugiTripleDrawEngine,
} from "../draw/SpecialDrawEngine.js";

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
registerEngine("badeucey_triple_draw", () => new BadeuceyTripleDrawEngine());
registerEngine("badacey_triple_draw", () => new BadaceyTripleDrawEngine());
registerEngine("hidugi_triple_draw", () => new HidugiTripleDrawEngine());
registerEngine("archie_triple_draw", () => new ArchieTripleDrawEngine());
registerEngine("deuce_to_seven_single_draw", () => new DeuceToSevenSingleDrawEngine());
registerEngine("ace_to_five_single_draw", () => new AceToFiveSingleDrawEngine());
registerEngine("five_card_single_draw", () => new FiveCardSingleDrawEngine());
registerEngine("badugi_single_draw", () => new BadugiSingleDrawEngine());
registerEngine("badeucey_single_draw", () => new BadeuceySingleDrawEngine());
registerEngine("badacey_single_draw", () => new BadaceySingleDrawEngine());
registerEngine("hidugi_single_draw", () => new HidugiSingleDrawEngine());
