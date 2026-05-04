import { describe, expect, it } from "vitest";
import { FLHGameController } from "../nlh/FLHGameController.js";
import { NLHGameController } from "../nlh/NLHGameController.js";
import { PLO8GameController } from "../plo/PLO8GameController.js";
import { PLOGameController } from "../plo/PLOGameController.js";
import StudGameController, {
  RazzGameController,
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

function assertNoBrokenActor(snapshot) {
  if (snapshot.street === "SHOWDOWN" || snapshot.phase === "SHOWDOWN") return;
  const actor = snapshot.currentActor ?? snapshot.turn;
  expect(actor).not.toBeNull();
  expect(actor).toBeGreaterThanOrEqual(0);
  const player = snapshot.players?.[actor];
  expect(player, `actor ${actor} must exist`).toBeTruthy();
  expect(player.folded).not.toBe(true);
  expect(player.seatOut).not.toBe(true);
  expect(player.allIn).not.toBe(true);
  expect(player.stack).toBeGreaterThan(0);
}

function chooseSafeAction(snapshot) {
  const actor = snapshot.currentActor ?? snapshot.turn;
  const player = snapshot.players[actor];
  const currentBet = Number(snapshot.currentBet ?? 0) || 0;
  const committed = Number(player.betThisStreet ?? player.betThisRound ?? 0) || 0;
  const toCall = Math.max(0, currentBet - committed);
  if (toCall > 0) return { seatIndex: actor, action: "call" };
  return { seatIndex: actor, action: "check" };
}

function driveOneHand(controller) {
  const initialTotal = totalStacks(controller.state.players);
  let snapshot = controller.startNewHand();
  expect(totalAccounting(snapshot.players)).toBe(initialTotal);
  for (let step = 0; step < 80; step += 1) {
    snapshot = controller.getSnapshot();
    if (snapshot.street === "SHOWDOWN" || snapshot.phase === "SHOWDOWN") break;
    assertNoBrokenActor(snapshot);
    const action = chooseSafeAction(snapshot);
    const result = controller.applyPlayerAction(action);
    expect(result.success, result.reason).toBe(true);
    const after = controller.getSnapshot();
    after.players.forEach((player) => {
      expect(player.stack).toBeGreaterThanOrEqual(0);
      expect(player.totalInvested).toBeGreaterThanOrEqual(0);
    });
    if (after.street !== "SHOWDOWN" && after.phase !== "SHOWDOWN") {
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
  const cases = [
    ["nlh", NLHGameController],
    ["flh", FLHGameController],
    ["plo", PLOGameController],
    ["plo8", PLO8GameController],
    ["stud", StudGameController],
    ["stud8", Stud8GameController],
    ["razz", RazzGameController],
  ];

  it.each(cases)("%s completes a hand without broken actors or chip drift", (_name, Controller) => {
    const controller = new Controller({
      tableConfig: {
        seats: makeSeats(),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
    });
    driveOneHand(controller);
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
});
