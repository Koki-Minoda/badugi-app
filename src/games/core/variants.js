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
import FLHGameController from "../nlh/FLHGameController.js";
import NLHGameController from "../nlh/NLHGameController.js";
import BigOGameController from "../plo/BigOGameController.js";
import FiveCardPLOGameController from "../plo/FiveCardPLOGameController.js";
import PLO8GameController from "../plo/PLO8GameController.js";
import PLOGameController from "../plo/PLOGameController.js";
import StudGameController, {
  RazzGameController,
  Stud8GameController,
} from "../stud/StudGameController.js";

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
  nlh: {
    id: "nlh",
    variantId: "B01",
    label: "No-Limit Hold'em",
    controllerFactory: (config = {}) =>
      new NLHGameController({ tableConfig: config.tableConfig ?? config }),
  },
  flh: {
    id: "flh",
    variantId: "B02",
    label: "Fixed-Limit Hold'em",
    controllerFactory: (config = {}) =>
      new FLHGameController({ tableConfig: config.tableConfig ?? config }),
  },
  plo: {
    id: "plo",
    variantId: "B05",
    label: "Pot-Limit Omaha",
    controllerFactory: (config = {}) =>
      new PLOGameController({ tableConfig: config.tableConfig ?? config }),
  },
  plo8: {
    id: "plo8",
    variantId: "B06",
    label: "PLO8",
    controllerFactory: (config = {}) =>
      new PLO8GameController({ tableConfig: config.tableConfig ?? config }),
  },
  big_o: {
    id: "big_o",
    variantId: "B07",
    label: "Big-O",
    controllerFactory: (config = {}) =>
      new BigOGameController({ tableConfig: config.tableConfig ?? config }),
  },
  five_card_plo: {
    id: "five_card_plo",
    variantId: "B08",
    label: "5-Card PLO",
    controllerFactory: (config = {}) =>
      new FiveCardPLOGameController({ tableConfig: config.tableConfig ?? config }),
  },
  stud: {
    id: "stud",
    variantId: "ST1",
    label: "Stud",
    controllerFactory: (config = {}) =>
      new StudGameController({ tableConfig: config.tableConfig ?? config }),
  },
  stud8: {
    id: "stud8",
    variantId: "ST2",
    label: "Stud 8",
    controllerFactory: (config = {}) =>
      new Stud8GameController({ tableConfig: config.tableConfig ?? config }),
  },
  razz: {
    id: "razz",
    variantId: "ST3",
    label: "Razz",
    controllerFactory: (config = {}) =>
      new RazzGameController({ tableConfig: config.tableConfig ?? config }),
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
