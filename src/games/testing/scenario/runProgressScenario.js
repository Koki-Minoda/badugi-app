import { DeuceToSevenTripleDrawController } from "../../draw/DeuceToSevenTripleDrawController.js";
import { AceToFiveTripleDrawController } from "../../draw/AceToFiveTripleDrawController.js";
import { DeuceToSevenSingleDrawController } from "../../draw/DeuceToSevenSingleDrawController.js";
import { AceToFiveSingleDrawController } from "../../draw/AceToFiveSingleDrawController.js";
import { FiveCardSingleDrawController } from "../../draw/FiveCardSingleDrawController.js";
import {
  ArchieTripleDrawController,
  BadaceySingleDrawController,
  BadaceyTripleDrawController,
  BadeuceySingleDrawController,
  BadeuceyTripleDrawController,
  BadugiSingleDrawController,
  HidugiSingleDrawController,
  HidugiTripleDrawController,
} from "../../draw/SpecialDrawController.js";
import { DramahaGameController } from "../../dramaha/DramahaGameController.js";
import { FLHGameController } from "../../nlh/FLHGameController.js";
import { FLSuperHoldemGameController, SuperHoldemGameController } from "../../nlh/SuperHoldemGameController.js";
import { NLHGameController } from "../../nlh/NLHGameController.js";
import { BigOGameController } from "../../plo/BigOGameController.js";
import { FiveCardPLOGameController } from "../../plo/FiveCardPLOGameController.js";
import { FLO8GameController } from "../../plo/FLO8GameController.js";
import { PLO8GameController } from "../../plo/PLO8GameController.js";
import { PLOGameController } from "../../plo/PLOGameController.js";
import { StudGameController } from "../../stud/StudGameController.js";
import StudGameDefinition from "../../stud/StudGameDefinition.js";
import Stud8GameDefinition from "../../stud/Stud8GameDefinition.js";
import RazzGameDefinition from "../../stud/RazzGameDefinition.js";
import Razz27GameDefinition from "../../stud/Razz27GameDefinition.js";
import RazzdugiGameDefinition from "../../stud/RazzdugiGameDefinition.js";
import RazzduceyGameDefinition from "../../stud/RazzduceyGameDefinition.js";
import { assertGameProgressInvariants, getActorIndex } from "../progress/gameProgressInvariants.js";

const DEFAULT_SEATS = ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"];
const DEFAULT_BLINDS = { sb: 10, bb: 20, ante: 0 };

export const PROGRESS_SCENARIOS = Object.freeze([
  "sb-fold-bb-option",
  "bb-option-after-limp",
  "heads-up-all-in",
  "multiway-all-in",
  "draw-count-full-cycle",
  "cpu-draw-auto-resolve",
  "cpu-bust-reseat",
  "mtt-table-merge",
  "cash-10-hands-smoke",
  "tournament-50-hands-smoke",
]);

export function createProgressSeats({ count = 6, stack = 500 } = {}) {
  return Array.from({ length: count }, (_, seatIndex) => ({
    seatIndex,
    seatType: seatIndex === 0 ? "HUMAN" : "CPU",
    playerId: seatIndex === 0 ? "hero" : `cpu-${seatIndex}`,
    id: seatIndex === 0 ? "hero" : `cpu-${seatIndex}`,
    name: seatIndex === 0 ? "You" : `CPU ${seatIndex}`,
    stack,
  }));
}

const STUD_DEFINITIONS = {
  stud: StudGameDefinition,
  stud8: Stud8GameDefinition,
  razz: RazzGameDefinition,
  razz27: Razz27GameDefinition,
  razzdugi: RazzdugiGameDefinition,
  razzducey: RazzduceyGameDefinition,
};

const DRAW_CONTROLLERS = {
  D01: DeuceToSevenTripleDrawController,
  D02: AceToFiveTripleDrawController,
  D04: BadeuceyTripleDrawController,
  D05: BadaceyTripleDrawController,
  D06: HidugiTripleDrawController,
  D07: ArchieTripleDrawController,
  S01: DeuceToSevenSingleDrawController,
  S02: AceToFiveSingleDrawController,
  S03: FiveCardSingleDrawController,
  S04: BadugiSingleDrawController,
  S05: BadeuceySingleDrawController,
  S06: BadaceySingleDrawController,
  S07: HidugiSingleDrawController,
};

const BOARD_CONTROLLERS = {
  nlh: NLHGameController,
  flh: FLHGameController,
  super_holdem: SuperHoldemGameController,
  fl_super_holdem: FLSuperHoldemGameController,
  plo: PLOGameController,
  plo8: PLO8GameController,
  big_o: BigOGameController,
  five_card_plo: FiveCardPLOGameController,
  flo8: FLO8GameController,
};

const DRAMAHA_VARIANTS = new Set([
  "dramaha_hi",
  "dramaha_27",
  "dramaha_a5",
  "dramaha_zero",
  "dramaha_hidugi",
  "dramaha_badugi",
]);

const VARIANT_ALIASES = {
  B01: "nlh",
  B02: "flh",
  B03: "super_holdem",
  B04: "fl_super_holdem",
  B05: "plo",
  B06: "plo8",
  B07: "big_o",
  B08: "five_card_plo",
  B09: "flo8",
  D03: "badugi",
  H01: "dramaha_hi",
  H02: "dramaha_27",
  H03: "dramaha_a5",
  H04: "dramaha_zero",
  H05: "dramaha_hidugi",
  H06: "dramaha_badugi",
  ST1: "stud",
  ST2: "stud8",
  ST3: "razz",
  ST4: "razzdugi",
  ST5: "razzducey",
  ST6: "razz27",
  CP1: "chinese_poker",
};

export function normalizeProgressVariantId(variantId) {
  return VARIANT_ALIASES[variantId] ?? variantId;
}

export function getProgressHarnessStatus(variantId) {
  const normalizedVariantId = normalizeProgressVariantId(variantId);
  if (BOARD_CONTROLLERS[normalizedVariantId]) return { supported: true, family: "board" };
  if (STUD_DEFINITIONS[normalizedVariantId]) return { supported: true, family: "stud" };
  if (DRAW_CONTROLLERS[normalizedVariantId]) return { supported: true, family: "draw" };
  if (DRAMAHA_VARIANTS.has(normalizedVariantId)) return { supported: true, family: "dramaha" };
  if (normalizedVariantId === "badugi") {
    return {
      supported: false,
      family: "badugi",
      reason: "Badugi cash/MTT progression is covered by existing App E2E driver; controller unit fixture requires legacy App lifecycle wiring.",
    };
  }
  return { supported: false, family: "unknown", reason: "No progress harness controller mapping yet." };
}

export function createProgressHarness(variantId, options = {}) {
  const normalizedVariantId = normalizeProgressVariantId(variantId);
  const seats = createProgressSeats({ count: options.seatCount ?? 6, stack: options.startingStack ?? 500 });
  if (BOARD_CONTROLLERS[normalizedVariantId]) {
    const Controller = BOARD_CONTROLLERS[normalizedVariantId];
    const controller = new Controller({
      tableConfig: { seats, blinds: { ...DEFAULT_BLINDS, ...(options.blinds ?? {}) } },
    });
    controller.startNewHand({ handId: `${normalizedVariantId}-progress-1` });
    return { family: "board", controller };
  }
  if (STUD_DEFINITIONS[normalizedVariantId]) {
    const controller = new StudGameController({
      variant: normalizedVariantId,
      gameDefinition: STUD_DEFINITIONS[normalizedVariantId],
      tableConfig: { seats, blinds: { sb: 10, bb: 20, ante: 2, ...(options.blinds ?? {}) } },
    });
    controller.startNewHand({ handId: `${normalizedVariantId}-progress-1` });
    return { family: "stud", controller };
  }
  if (DRAMAHA_VARIANTS.has(normalizedVariantId)) {
    const controller = new DramahaGameController({
      variant: normalizedVariantId,
      tableConfig: { seats, blinds: { ...DEFAULT_BLINDS, ...(options.blinds ?? {}) } },
    });
    controller.startNewHand({ handId: `${normalizedVariantId}-progress-1` });
    return { family: "dramaha", controller };
  }
  if (DRAW_CONTROLLERS[normalizedVariantId]) {
    const Controller = DRAW_CONTROLLERS[normalizedVariantId];
    const controller = new Controller({
      tableConfig: {
        seatConfig: DEFAULT_SEATS,
        startingStack: options.startingStack ?? 500,
        structure: { ...DEFAULT_BLINDS, ...(options.blinds ?? {}) },
      },
    });
    let state = controller.createInitialState();
    state = controller.createNewHandState(state, { handId: `${normalizedVariantId}-progress-1` });
    return { family: "draw", controller, state };
  }
  const status = getProgressHarnessStatus(variantId);
  throw new Error(`Unsupported progress harness variant=${variantId} reason=${status.reason}`);
}

function snapshotOf(harness) {
  if (harness.family === "draw") return harness.state?.snapshot ?? harness.controller.getUiSnapshot();
  return harness.controller.getSnapshot();
}

function isTerminal(snapshot = {}) {
  const phase = String(snapshot.phase ?? snapshot.street ?? "").toUpperCase();
  return Boolean(snapshot.lastHandResult || phase === "SHOWDOWN" || phase === "HAND_RESULT");
}

function buildSignature(snapshot = {}) {
  const players = Array.isArray(snapshot.players) ? snapshot.players : [];
  return JSON.stringify({
    phase: snapshot.phase ?? snapshot.street,
    actor: getActorIndex(snapshot),
    currentBet: snapshot.currentBet ?? snapshot.metadata?.currentBet ?? 0,
    pot: snapshot.pot ?? snapshot.pots?.[0]?.amount ?? 0,
    stacks: players.map((player) => player?.stack ?? 0),
    bets: players.map((player) => player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0),
    last: players.map((player) => player?.lastAction ?? ""),
  });
}

function describeFailure(snapshot, context = {}) {
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  return {
    ...context,
    phase: snapshot?.phase ?? snapshot?.street,
    actor: getActorIndex(snapshot),
    legalActions: context.legalActions ?? [],
    stacks: players.map((player) => player?.stack ?? 0),
    pot: snapshot?.pot ?? snapshot?.pots?.[0]?.amount ?? 0,
    lastAction: players.map((player) => player?.lastAction ?? "").filter(Boolean).at(-1) ?? null,
  };
}

function choosePassiveBoardAction(snapshot = {}, actor) {
  const player = snapshot.players?.[actor];
  const currentBet = Number(snapshot.currentBet ?? 0);
  const playerBet = Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0);
  const toCall = Math.max(0, currentBet - playerBet);
  return {
    action: String(snapshot.phase ?? snapshot.street).toUpperCase() === "DRAW" ? "draw" : toCall > 0 ? "call" : "check",
    amount: toCall,
    metadata: { discardIndexes: [] },
  };
}

function stepHarness(harness) {
  const snapshot = snapshotOf(harness);
  const actor = getActorIndex(snapshot);
  if (actor == null || isTerminal(snapshot)) return { progressed: false, snapshot };

  if (harness.family === "draw") {
    const legalActions = harness.controller.getLegalActions(harness.state, actor);
    const draw = legalActions.find((action) => action.type === "DRAW");
    const call = legalActions.find((action) => action.type === "CALL");
    const check = legalActions.find((action) => action.type === "CHECK");
    const payload = draw
      ? { seatIndex: actor, type: "DRAW", discardIndexes: [] }
      : { seatIndex: actor, type: call ? "CALL" : check ? "CHECK" : "FOLD" };
    const result = harness.controller.applyAction(harness.state, payload);
    harness.state = result.state;
    return { progressed: true, snapshot: snapshotOf(harness), legalActions };
  }

  const passiveAction = choosePassiveBoardAction(snapshot, actor);
  const result = harness.controller.applyPlayerAction({
    seatIndex: actor,
    ...passiveAction,
  });
  if (!result?.success) {
    throw new Error(
      `[MGX_PROGRESS_SCENARIO] action rejected ${JSON.stringify(
        describeFailure(snapshot, { reason: result?.reason, attemptedAction: passiveAction }),
      )}`,
    );
  }
  return { progressed: true, snapshot: snapshotOf(harness), legalActions: [passiveAction] };
}

export function runProgressScenario({
  variantId,
  scenarioId = "cash-10-hands-smoke",
  seed = "mgx-progress-default",
  maxSteps = 160,
  invariantContext = {},
} = {}) {
  const status = getProgressHarnessStatus(variantId);
  if (!status.supported) {
    return { variantId, scenarioId, seed, status: "skipped", reason: status.reason };
  }
  const harness = createProgressHarness(variantId);
  let repeated = 0;
  let previousSignature = null;
  const visited = [];

  for (let step = 0; step < maxSteps; step += 1) {
    const snapshot = snapshotOf(harness);
    const context = { variantId, scenarioId, seed, step, snapshot, ...invariantContext };
    assertGameProgressInvariants(snapshot, context);
    visited.push(String(snapshot.phase ?? snapshot.street ?? "UNKNOWN"));
    if (isTerminal(snapshot)) {
      return { variantId, scenarioId, seed, status: "passed", steps: step, visited };
    }
    const signature = buildSignature(snapshot);
    repeated = signature === previousSignature ? repeated + 1 : 0;
    previousSignature = signature;
    if (repeated >= 8) {
      throw new Error(
        `[MGX_PROGRESS_FREEZE] repeated state ${JSON.stringify(describeFailure(snapshot, context))}`,
      );
    }
    stepHarness(harness);
  }
  throw new Error(
    `[MGX_PROGRESS_TIMEOUT] maxSteps reached ${JSON.stringify(
      describeFailure(snapshotOf(harness), { variantId, scenarioId, seed, maxSteps }),
    )}`,
  );
}

export function buildSyntheticSnapshot(overrides = {}) {
  return {
    variantId: "synthetic",
    phase: "BET",
    currentBet: 20,
    pot: 30,
    players: [
      { seatIndex: 0, playerId: "hero", stack: 480, betThisStreet: 20 },
      { seatIndex: 1, playerId: "sb", stack: 490, betThisStreet: 10 },
      { seatIndex: 2, playerId: "bb", stack: 480, betThisStreet: 20 },
    ],
    currentActor: 0,
    ...overrides,
  };
}
