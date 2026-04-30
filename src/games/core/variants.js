// src/games/core/variants.js
/**
 * Registry of supported game variants.
 * Each entry should expose an id, label, and controllerFactory.
 *
 * Controller factories for the currently playable draw-family variants.
 * Future entries (NLH, PLO, Stud, etc.) can follow the same structure once
 * their controllers exist.
 */

import { BadugiGameController } from "../badugi/controller/BadugiGameController.js";
import { AceToFiveSingleDrawController } from "../draw/AceToFiveSingleDrawController.js";
import { AceToFiveTripleDrawController } from "../draw/AceToFiveTripleDrawController.js";
import { DeuceToSevenSingleDrawController } from "../draw/DeuceToSevenSingleDrawController.js";
import { DeuceToSevenTripleDrawController } from "../draw/DeuceToSevenTripleDrawController.js";

function drawControllerFactory(Controller) {
  return (config = {}) =>
    new Controller({
      tableConfig: config,
    });
}

export const GAME_VARIANTS = {
  badugi: {
    id: "badugi",
    variantId: "D03",
    label: "Badugi",
    controllerFactory: (config = {}) => new BadugiGameController(config),
  },
  deuce_to_seven_triple_draw: {
    id: "deuce_to_seven_triple_draw",
    variantId: "D01",
    label: "2-7 Triple Draw",
    controllerFactory: drawControllerFactory(DeuceToSevenTripleDrawController),
  },
  ace_to_five_triple_draw: {
    id: "ace_to_five_triple_draw",
    variantId: "D02",
    label: "A-5 Triple Draw",
    controllerFactory: drawControllerFactory(AceToFiveTripleDrawController),
  },
  deuce_to_seven_single_draw: {
    id: "deuce_to_seven_single_draw",
    variantId: "S01",
    label: "2-7 Single Draw",
    controllerFactory: drawControllerFactory(DeuceToSevenSingleDrawController),
  },
  ace_to_five_single_draw: {
    id: "ace_to_five_single_draw",
    variantId: "S02",
    label: "A-5 Single Draw",
    controllerFactory: drawControllerFactory(AceToFiveSingleDrawController),
  },
};

export default GAME_VARIANTS;
