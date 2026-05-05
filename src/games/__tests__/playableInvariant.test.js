import { describe, expect, it } from "vitest";
import { FLHGameController } from "../nlh/FLHGameController.js";
import { NLHGameController } from "../nlh/NLHGameController.js";
import SuperHoldemGameController, {
  FLSuperHoldemGameController,
} from "../nlh/SuperHoldemGameController.js";
import { PLO8GameController } from "../plo/PLO8GameController.js";
import { FLO8GameController } from "../plo/FLO8GameController.js";
import { PLOGameController } from "../plo/PLOGameController.js";
import BigOGameController from "../plo/BigOGameController.js";
import FiveCardPLOGameController from "../plo/FiveCardPLOGameController.js";
import BadugiGameController from "../badugi/controller/BadugiGameController.js";
import { DramahaGameController } from "../dramaha/DramahaGameController.js";
import { DeuceToSevenTripleDrawController } from "../draw/DeuceToSevenTripleDrawController.js";
import { AceToFiveTripleDrawController } from "../draw/AceToFiveTripleDrawController.js";
import { DeuceToSevenSingleDrawController } from "../draw/DeuceToSevenSingleDrawController.js";
import { AceToFiveSingleDrawController } from "../draw/AceToFiveSingleDrawController.js";
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
import StudGameController, {
  Razz27GameController,
  RazzGameController,
  RazzduceyGameController,
  RazzdugiGameController,
  Stud8GameController,
} from "../stud/StudGameController.js";

function makeSeats(stacks = [120, 100, 80, 60]) {
  return stacks.map((stack, idx) => ({
    seatIndex: idx,
    playerId: `p${idx}`,
    name: idx === 0 ? "Hero" : `CPU ${idx}`,
    stack,
  }));
}

function totalStacks(players = []) {
  return players.reduce((sum, player) => sum + Math.max(0, Number(player?.stack) || 0), 0);
}

function totalAccounting(players = []) {
  return players.reduce(
    (sum, player) =>
      sum +
      Math.max(0, Number(player?.stack) || 0) +
      Math.max(0, Number(player?.totalInvested) || 0),
    0,
  );
}

function isTerminalSnapshot(snapshot = {}) {
  return Boolean(
    snapshot.street === "SHOWDOWN" ||
      snapshot.phase === "SHOWDOWN" ||
      snapshot.phase === "HAND_RESULT" ||
      snapshot.lastHandResult,
  );
}

function assertNoBrokenActor(snapshot) {
  if (isTerminalSnapshot(snapshot)) return;
  const actor =
    snapshot.currentActor ??
    snapshot.actingPlayerIndex ??
    snapshot.nextTurn ??
    snapshot.turn;
  expect(actor).not.toBeNull();
  expect(actor).toBeGreaterThanOrEqual(0);
  const player = snapshot.players?.[actor];
  expect(player, `actor ${actor} must exist`).toBeTruthy();
  expect(player.folded).not.toBe(true);
  expect(player.seatOut).not.toBe(true);
  if (snapshot.street === "DRAW" || snapshot.phase === "DRAW") {
    return;
  }
  expect(player.allIn).not.toBe(true);
  expect(player.stack).toBeGreaterThan(0);
}

function chooseSafeAction(snapshot) {
  const actor =
    snapshot.currentActor ??
    snapshot.actingPlayerIndex ??
    snapshot.nextTurn ??
    snapshot.turn;
  const player = snapshot.players[actor];
  if (snapshot.street === "DRAW" || snapshot.phase === "DRAW") {
    return { seatIndex: actor, action: "draw", metadata: { discardIndexes: [] } };
  }
  const currentBet = Number(snapshot.currentBet ?? 0) || 0;
  const committed = Number(player.betThisStreet ?? player.betThisRound ?? 0) || 0;
  const toCall = Math.max(0, currentBet - committed);
  if (toCall > 0) return { seatIndex: actor, action: "call" };
  return { seatIndex: actor, action: "check" };
}

function driveOneHand(controller) {
  if (!controller.state?.players && typeof controller.createNewHandState === "function") {
    return driveGenericControllerHand(controller);
  }
  const initialTotal = totalStacks(controller.state.players);
  let snapshot = controller.startNewHand();
  expect(totalAccounting(snapshot.players)).toBe(initialTotal);
  for (let step = 0; step < 400; step += 1) {
    snapshot = controller.getSnapshot();
    if (isTerminalSnapshot(snapshot)) break;
    assertNoBrokenActor(snapshot);
    const action = chooseSafeAction(snapshot);
    const result = controller.applyPlayerAction(action);
    expect(result.success, result.reason).toBe(true);
    const after = controller.getSnapshot();
    after.players.forEach((player) => {
      expect(player.stack).toBeGreaterThanOrEqual(0);
      expect(player.totalInvested).toBeGreaterThanOrEqual(0);
    });
    if (!isTerminalSnapshot(after)) {
      expect(totalAccounting(after.players)).toBe(initialTotal);
    }
  }
  snapshot = controller.getSnapshot();
  expect(snapshot.street).toBe("SHOWDOWN");
  const result = controller.state.lastHandResult ?? controller.resolveShowdown();
  expect(result.totalPot).toBeGreaterThanOrEqual(0);
  expect(totalStacks(controller.state.players)).toBe(initialTotal);
}

function chooseGenericAction(snapshot) {
  const actor =
    snapshot.currentActor ??
    snapshot.actingPlayerIndex ??
    snapshot.nextTurn ??
    snapshot.turn;
  const player = snapshot.players[actor];
  if (snapshot.street === "DRAW" || snapshot.phase === "DRAW") {
    return {
      seatIndex: actor,
      type: "DRAW",
      discardIndexes: [],
      payload: { type: "DRAW", discardIndexes: [], drawIndexes: [], drawCount: 0 },
    };
  }
  const currentBet = Number(snapshot.currentBet ?? snapshot.metadata?.currentBet ?? 0) || 0;
  const committed = Number(player.betThisStreet ?? player.betThisRound ?? player.bet ?? 0) || 0;
  const toCall = Math.max(0, currentBet - committed);
  if (toCall > 0) return { seatIndex: actor, type: "CALL", payload: { type: "CALL" } };
  return { seatIndex: actor, type: "CHECK", payload: { type: "CHECK" } };
}

function driveGenericControllerHand(controller) {
  let state = controller.createNewHandState(controller.createInitialState?.() ?? {});
  let snapshot = controller.getUiSnapshot(state);
  const initialTotal = totalAccounting(snapshot.players);
  expect(totalAccounting(snapshot.players)).toBe(initialTotal);
  for (let step = 0; step < 400; step += 1) {
    snapshot = controller.getUiSnapshot(state);
    if (isTerminalSnapshot(snapshot)) break;
    assertNoBrokenActor(snapshot);
    const result = controller.applyAction(state, chooseGenericAction(snapshot));
    expect(result.events?.[0]?.type).not.toBe("invalidAction");
    state = result.state;
    const after = controller.getUiSnapshot(state);
    after.players.forEach((player) => {
      expect(player.stack).toBeGreaterThanOrEqual(0);
      expect(player.totalInvested).toBeGreaterThanOrEqual(0);
    });
    if (!isTerminalSnapshot(after)) {
      expect(totalAccounting(after.players)).toBe(initialTotal);
    }
  }
  snapshot = controller.getUiSnapshot(state);
  expect(isTerminalSnapshot(snapshot)).toBe(true);
  expect(totalStacks(snapshot.players)).toBe(initialTotal);
}

function sawAllInPlayer(snapshot) {
  return (snapshot?.players ?? []).some(
    (player) => player?.allIn || (!player?.seatOut && Number(player?.stack) === 0),
  );
}

function driveAllInPressureDirectHand(controller) {
  const initialTotal = totalStacks(controller.state.players);
  let snapshot = controller.startNewHand();
  let sawAllIn = sawAllInPlayer(snapshot);
  expect(totalAccounting(snapshot.players)).toBe(initialTotal);
  for (let step = 0; step < 400; step += 1) {
    snapshot = controller.getSnapshot();
    sawAllIn = sawAllIn || sawAllInPlayer(snapshot);
    if (isTerminalSnapshot(snapshot)) break;
    assertNoBrokenActor(snapshot);
    const action = chooseSafeAction(snapshot);
    const result = controller.applyPlayerAction(action);
    expect(result.success, result.reason).toBe(true);
    const after = controller.getSnapshot();
    sawAllIn = sawAllIn || sawAllInPlayer(after);
    after.players.forEach((player) => {
      expect(player.stack).toBeGreaterThanOrEqual(0);
      expect(player.totalInvested).toBeGreaterThanOrEqual(0);
    });
    if (!isTerminalSnapshot(after)) {
      expect(totalAccounting(after.players)).toBe(initialTotal);
    }
  }
  snapshot = controller.getSnapshot();
  expect(snapshot.street).toBe("SHOWDOWN");
  const result = controller.state.lastHandResult ?? controller.resolveShowdown();
  expect(result.totalPot).toBeGreaterThanOrEqual(0);
  expect(totalStacks(controller.state.players)).toBe(initialTotal);
  expect(sawAllIn).toBe(true);
}

function driveAllInPressureGenericHand(controller) {
  let state = controller.createNewHandState(controller.createInitialState?.() ?? {});
  let snapshot = controller.getUiSnapshot(state);
  const initialTotal = totalAccounting(snapshot.players);
  let sawAllIn = sawAllInPlayer(snapshot);
  expect(totalAccounting(snapshot.players)).toBe(initialTotal);
  for (let step = 0; step < 400; step += 1) {
    snapshot = controller.getUiSnapshot(state);
    sawAllIn = sawAllIn || sawAllInPlayer(snapshot);
    if (isTerminalSnapshot(snapshot)) break;
    assertNoBrokenActor(snapshot);
    const result = controller.applyAction(state, chooseGenericAction(snapshot));
    expect(result.events?.[0]?.type).not.toBe("invalidAction");
    state = result.state;
    const after = controller.getUiSnapshot(state);
    sawAllIn = sawAllIn || sawAllInPlayer(after);
    after.players.forEach((player) => {
      expect(player.stack).toBeGreaterThanOrEqual(0);
      expect(player.totalInvested).toBeGreaterThanOrEqual(0);
    });
    if (!isTerminalSnapshot(after)) {
      expect(totalAccounting(after.players)).toBe(initialTotal);
    }
  }
  snapshot = controller.getUiSnapshot(state);
  expect(isTerminalSnapshot(snapshot)).toBe(true);
  expect(totalStacks(snapshot.players)).toBe(initialTotal);
  expect(sawAllIn).toBe(true);
}

function driveStartedHand(controller, initialTotal) {
  let snapshot = controller.getSnapshot();
  expect(totalAccounting(snapshot.players)).toBe(initialTotal);
  for (let step = 0; step < 400; step += 1) {
    snapshot = controller.getSnapshot();
    if (isTerminalSnapshot(snapshot)) break;
    assertNoBrokenActor(snapshot);
    const action = chooseSafeAction(snapshot);
    const result = controller.applyPlayerAction(action);
    expect(result.success, result.reason).toBe(true);
    const after = controller.getSnapshot();
    after.players.forEach((player) => {
      expect(player.stack).toBeGreaterThanOrEqual(0);
      expect(player.totalInvested).toBeGreaterThanOrEqual(0);
    });
    if (!isTerminalSnapshot(after)) {
      expect(totalAccounting(after.players)).toBe(initialTotal);
    }
  }
  snapshot = controller.getSnapshot();
  expect(snapshot.street).toBe("SHOWDOWN");
  const result = controller.state.lastHandResult ?? controller.resolveShowdown();
  expect(result.totalPot).toBeGreaterThanOrEqual(0);
  expect(totalStacks(controller.state.players)).toBe(initialTotal);
}

describe("playable invariant smoke", () => {
  const directControllerCases = [
    ["nlh", () => new NLHGameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["flh", () => new FLHGameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["super_holdem", () => new SuperHoldemGameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["fl_super_holdem", () => new FLSuperHoldemGameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["plo", () => new PLOGameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["plo8", () => new PLO8GameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["big_o", () => new BigOGameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["five_card_plo", () => new FiveCardPLOGameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["flo8", () => new FLO8GameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["dramaha_hi", () => new DramahaGameController({
      variant: "dramaha_hi",
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["dramaha_27", () => new DramahaGameController({
      variant: "dramaha_27",
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["dramaha_a5", () => new DramahaGameController({
      variant: "dramaha_a5",
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["dramaha_zero", () => new DramahaGameController({
      variant: "dramaha_zero",
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["dramaha_hidugi", () => new DramahaGameController({
      variant: "dramaha_hidugi",
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["dramaha_badugi", () => new DramahaGameController({
      variant: "dramaha_badugi",
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["stud", () => new StudGameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["stud8", () => new Stud8GameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["razz", () => new RazzGameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["razz27", () => new Razz27GameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["razzdugi", () => new RazzdugiGameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
    ["razzducey", () => new RazzduceyGameController({
      tableConfig: {
        seats: makeSeats([2000, 2000, 2000, 2000]),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    })],
  ];

  const drawControllerCases = [
    ["deuce_to_seven_triple_draw", () => new DeuceToSevenTripleDrawController()],
    ["ace_to_five_triple_draw", () => new AceToFiveTripleDrawController()],
    ["badugi", () => new BadugiGameController()],
    ["badeucey_triple_draw", () => new BadeuceyTripleDrawController()],
    ["badacey_triple_draw", () => new BadaceyTripleDrawController()],
    ["hidugi_triple_draw", () => new HidugiTripleDrawController()],
    ["archie_triple_draw", () => new ArchieTripleDrawController()],
    ["deuce_to_seven_single_draw", () => new DeuceToSevenSingleDrawController()],
    ["ace_to_five_single_draw", () => new AceToFiveSingleDrawController()],
    ["five_card_single_draw", () => new FiveCardSingleDrawController()],
    ["badugi_single_draw", () => new BadugiSingleDrawController()],
    ["badeucey_single_draw", () => new BadeuceySingleDrawController()],
    ["badacey_single_draw", () => new BadaceySingleDrawController()],
    ["hidugi_single_draw", () => new HidugiSingleDrawController()],
  ];

  const allInDirectControllerCases = [
    ["nlh", () => new NLHGameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
    ["flh", () => new FLHGameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
    ["super_holdem", () => new SuperHoldemGameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
    ["fl_super_holdem", () => new FLSuperHoldemGameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
    ["plo", () => new PLOGameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
    ["plo8", () => new PLO8GameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
    ["big_o", () => new BigOGameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
    ["five_card_plo", () => new FiveCardPLOGameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
    ["flo8", () => new FLO8GameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
    ...["dramaha_hi", "dramaha_27", "dramaha_a5", "dramaha_zero", "dramaha_hidugi", "dramaha_badugi"].map(
      (variant) => [variant, () => new DramahaGameController({
        variant,
        tableConfig: {
          seats: makeSeats([35, 5, 18, 60]),
          blinds: { sb: 5, bb: 10, ante: 0 },
        },
      })],
    ),
    ["stud", () => new StudGameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
    ["stud8", () => new Stud8GameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
    ["razz", () => new RazzGameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
    ["razz27", () => new Razz27GameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
    ["razzdugi", () => new RazzdugiGameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
    ["razzducey", () => new RazzduceyGameController({
      tableConfig: {
        seats: makeSeats([35, 5, 18, 60]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    })],
  ];

  const shortDrawTableConfig = {
    seatConfig: ["HUMAN", "CPU", "CPU", "CPU"],
    startingStack: 10,
    structure: { sb: 5, bb: 10, ante: 0 },
  };

  const allInDrawControllerCases = [
    ["deuce_to_seven_triple_draw", () => new DeuceToSevenTripleDrawController({ tableConfig: shortDrawTableConfig })],
    ["ace_to_five_triple_draw", () => new AceToFiveTripleDrawController({ tableConfig: shortDrawTableConfig })],
    ["badugi", () => new BadugiGameController({
      numSeats: 4,
      seatConfig: shortDrawTableConfig.seatConfig,
      startingStack: shortDrawTableConfig.startingStack,
      blindStructure: [{ sb: 5, bb: 10, ante: 0 }],
    })],
    ["badeucey_triple_draw", () => new BadeuceyTripleDrawController({ tableConfig: shortDrawTableConfig })],
    ["badacey_triple_draw", () => new BadaceyTripleDrawController({ tableConfig: shortDrawTableConfig })],
    ["hidugi_triple_draw", () => new HidugiTripleDrawController({ tableConfig: shortDrawTableConfig })],
    ["archie_triple_draw", () => new ArchieTripleDrawController({ tableConfig: shortDrawTableConfig })],
    ["deuce_to_seven_single_draw", () => new DeuceToSevenSingleDrawController({ tableConfig: shortDrawTableConfig })],
    ["ace_to_five_single_draw", () => new AceToFiveSingleDrawController({ tableConfig: shortDrawTableConfig })],
    ["five_card_single_draw", () => new FiveCardSingleDrawController({ tableConfig: shortDrawTableConfig })],
    ["badugi_single_draw", () => new BadugiSingleDrawController({ tableConfig: shortDrawTableConfig })],
    ["badeucey_single_draw", () => new BadeuceySingleDrawController({ tableConfig: shortDrawTableConfig })],
    ["badacey_single_draw", () => new BadaceySingleDrawController({ tableConfig: shortDrawTableConfig })],
    ["hidugi_single_draw", () => new HidugiSingleDrawController({ tableConfig: shortDrawTableConfig })],
  ];

  it.each(directControllerCases)("%s completes five consecutive hands without broken actors or chip drift", (_name, createController) => {
    const controller = createController();
    for (let hand = 0; hand < 5; hand += 1) {
      driveOneHand(controller);
    }
  });

  it.each(drawControllerCases)("%s completes five consecutive hands without broken actors or chip drift", (_name, createController) => {
    const controller = createController();
    for (let hand = 0; hand < 5; hand += 1) {
      driveGenericControllerHand(controller);
    }
  });

  it.each(allInDirectControllerCases)("%s resolves a short-stack all-in hand without broken actors or chip drift", (_name, createController) => {
    driveAllInPressureDirectHand(createController());
  });

  it.each(allInDrawControllerCases)("%s resolves a short-stack all-in hand without broken actors or chip drift", (_name, createController) => {
    driveAllInPressureGenericHand(createController());
  });

  it("keeps all-in short stacks from becoming invalid actors in split games", () => {
    const controller = new PLO8GameController({
      tableConfig: {
        seats: makeSeats([45, 20, 80, 120]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    });
    driveOneHand(controller);
  });

  it.each([
    ["super_holdem", SuperHoldemGameController],
    ["fl_super_holdem", FLSuperHoldemGameController],
  ])("%s deals three hole cards and resolves side pots without chip drift", (_name, Controller) => {
    const controller = new Controller({
      tableConfig: {
        seats: makeSeats([45, 20, 80, 120]),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    });
    const initialTotal = totalStacks(controller.state.players);
    const snapshot = controller.startNewHand();
    snapshot.players.filter((player) => !player.folded && !player.seatOut).forEach((player) => {
      expect(player.holeCards).toHaveLength(3);
    });
    driveStartedHand(controller, initialTotal);
  });
});
