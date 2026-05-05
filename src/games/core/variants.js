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
import { DramahaGameController } from "../dramaha/DramahaGameController.js";
import { AceToFiveSingleDrawController } from "../draw/AceToFiveSingleDrawController.js";
import { AceToFiveTripleDrawController } from "../draw/AceToFiveTripleDrawController.js";
import { DeuceToSevenSingleDrawController } from "../draw/DeuceToSevenSingleDrawController.js";
import { DeuceToSevenTripleDrawController } from "../draw/DeuceToSevenTripleDrawController.js";
import { FiveCardSingleDrawController } from "../draw/FiveCardSingleDrawController.js";
import {
  ArchieTripleDrawController,
  BadaceySingleDrawController,
  BadaceyTripleDrawController,
  BadeuceySingleDrawController,
  BadeuceyTripleDrawController,
  BadugiSingleDrawController,
  HidugiSingleDrawController,
  HidugiTripleDrawController,
} from "../draw/SpecialDrawController.js";
import FLHGameController from "../nlh/FLHGameController.js";
import NLHGameController from "../nlh/NLHGameController.js";
import SuperHoldemGameController, {
  FLSuperHoldemGameController,
} from "../nlh/SuperHoldemGameController.js";
import BigOGameController from "../plo/BigOGameController.js";
import FiveCardPLOGameController from "../plo/FiveCardPLOGameController.js";
import FLO8GameController from "../plo/FLO8GameController.js";
import PLO8GameController from "../plo/PLO8GameController.js";
import PLOGameController from "../plo/PLOGameController.js";
import StudGameController, {
  Razz27GameController,
  RazzGameController,
  RazzduceyGameController,
  RazzdugiGameController,
  Stud8GameController,
} from "../stud/StudGameController.js";

function drawControllerFactory(Controller) {
  return (config = {}) =>
    new Controller({
      tableConfig: config,
    });
}

function dramahaControllerFactory(variant) {
  return (config = {}) =>
    new DramahaGameController({
      variant,
      tableConfig: config.tableConfig ?? config,
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
  super_holdem: {
    id: "super_holdem",
    variantId: "B03",
    label: "NL Super Hold'em",
    controllerFactory: (config = {}) =>
      new SuperHoldemGameController({ tableConfig: config.tableConfig ?? config }),
  },
  fl_super_holdem: {
    id: "fl_super_holdem",
    variantId: "B04",
    label: "FL Super Hold'em",
    controllerFactory: (config = {}) =>
      new FLSuperHoldemGameController({ tableConfig: config.tableConfig ?? config }),
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
  flo8: {
    id: "flo8",
    variantId: "B09",
    label: "FLO8",
    controllerFactory: (config = {}) =>
      new FLO8GameController({ tableConfig: config.tableConfig ?? config }),
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
  razz27: {
    id: "razz27",
    variantId: "ST6",
    label: "2-7 Razz",
    controllerFactory: (config = {}) =>
      new Razz27GameController({ tableConfig: config.tableConfig ?? config }),
  },
  razzdugi: {
    id: "razzdugi",
    variantId: "ST4",
    label: "Razzdugi",
    controllerFactory: (config = {}) =>
      new RazzdugiGameController({ tableConfig: config.tableConfig ?? config }),
  },
  razzducey: {
    id: "razzducey",
    variantId: "ST5",
    label: "Razzducey",
    controllerFactory: (config = {}) =>
      new RazzduceyGameController({ tableConfig: config.tableConfig ?? config }),
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
  badeucey_triple_draw: {
    id: "badeucey_triple_draw",
    variantId: "D04",
    label: "Badeucey TD",
    controllerFactory: drawControllerFactory(BadeuceyTripleDrawController),
  },
  badacey_triple_draw: {
    id: "badacey_triple_draw",
    variantId: "D05",
    label: "Badacey TD",
    controllerFactory: drawControllerFactory(BadaceyTripleDrawController),
  },
  hidugi_triple_draw: {
    id: "hidugi_triple_draw",
    variantId: "D06",
    label: "Hidugi TD",
    controllerFactory: drawControllerFactory(HidugiTripleDrawController),
  },
  archie_triple_draw: {
    id: "archie_triple_draw",
    variantId: "D07",
    label: "Archie TD",
    controllerFactory: drawControllerFactory(ArchieTripleDrawController),
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
  five_card_single_draw: {
    id: "five_card_single_draw",
    variantId: "S03",
    label: "5-Card Single Draw",
    controllerFactory: drawControllerFactory(FiveCardSingleDrawController),
  },
  badugi_single_draw: {
    id: "badugi_single_draw",
    variantId: "S04",
    label: "Badugi Single Draw",
    controllerFactory: drawControllerFactory(BadugiSingleDrawController),
  },
  badeucey_single_draw: {
    id: "badeucey_single_draw",
    variantId: "S05",
    label: "Badeucey Single Draw",
    controllerFactory: drawControllerFactory(BadeuceySingleDrawController),
  },
  badacey_single_draw: {
    id: "badacey_single_draw",
    variantId: "S06",
    label: "Badacey Single Draw",
    controllerFactory: drawControllerFactory(BadaceySingleDrawController),
  },
  hidugi_single_draw: {
    id: "hidugi_single_draw",
    variantId: "S07",
    label: "Hidugi Single Draw",
    controllerFactory: drawControllerFactory(HidugiSingleDrawController),
  },
  dramaha_hi: {
    id: "dramaha_hi",
    variantId: "H01",
    label: "Dramaha Hi",
    controllerFactory: dramahaControllerFactory("dramaha_hi"),
  },
  dramaha_27: {
    id: "dramaha_27",
    variantId: "H02",
    label: "Dramaha 2-7",
    controllerFactory: dramahaControllerFactory("dramaha_27"),
  },
  dramaha_a5: {
    id: "dramaha_a5",
    variantId: "H03",
    label: "Dramaha A-5",
    controllerFactory: dramahaControllerFactory("dramaha_a5"),
  },
  dramaha_zero: {
    id: "dramaha_zero",
    variantId: "H04",
    label: "Dramaha Zero",
    controllerFactory: dramahaControllerFactory("dramaha_zero"),
  },
  dramaha_hidugi: {
    id: "dramaha_hidugi",
    variantId: "H05",
    label: "Dramaha Hidugi",
    controllerFactory: dramahaControllerFactory("dramaha_hidugi"),
  },
  dramaha_badugi: {
    id: "dramaha_badugi",
    variantId: "H06",
    label: "Dramaha Badugi",
    controllerFactory: dramahaControllerFactory("dramaha_badugi"),
  },
};

export default GAME_VARIANTS;
