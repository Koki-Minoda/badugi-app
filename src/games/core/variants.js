// src/games/core/variants.js
/**
 * Registry of supported game variants.
 * Each entry should expose an id, label, and controllerFactory.
 *
 * Badugi is the only implemented variant today. Future entries (NLH, PLO,
 * Stud, etc.) can follow the same structure once their controllers exist.
 */

import { BadugiGameController } from "../badugi/controller/BadugiGameController.js";

export const GAME_VARIANTS = {
  badugi: {
    id: "badugi",
    label: "Badugi",
    controllerFactory: (config = {}) => new BadugiGameController(config),
  },
};

export default GAME_VARIANTS;
