import { describe, expect, test } from "vitest";
import {
  assertGameProgressInvariants,
  assertTournamentInvariants,
} from "../progress/gameProgressInvariants.js";
import { buildSyntheticSnapshot, runProgressScenario } from "../scenario/runProgressScenario.js";

function expectInvariantFailure(snapshot, match, context = {}) {
  expect(() => assertGameProgressInvariants(snapshot, context)).toThrow(match);
}

describe("MGX known game progress bug regressions", () => {
  test("ACTION-001 SB fold should not skip BB option", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "nlh",
      currentActor: 2,
      players: [
        { seatIndex: 0, playerId: "btn", stack: 480, betThisStreet: 20 },
        { seatIndex: 1, playerId: "sb", stack: 490, betThisStreet: 10, folded: true, hasFolded: true },
        { seatIndex: 2, playerId: "bb", stack: 480, betThisStreet: 20 },
      ],
    });
    expect(() => assertGameProgressInvariants(snapshot, { variantId: "nlh", scenarioId: "ACTION-001" })).not.toThrow();
  });

  test("ACTION-002 BB option should remain available after limp/call", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "flh",
      currentBet: 20,
      currentActor: 2,
      players: [
        { seatIndex: 0, playerId: "btn", stack: 480, betThisStreet: 20, lastAction: "Call" },
        { seatIndex: 1, playerId: "sb", stack: 490, betThisStreet: 20, lastAction: "Call" },
        { seatIndex: 2, playerId: "bb", stack: 480, betThisStreet: 20, legalActions: [{ type: "CHECK" }, { type: "RAISE" }] },
      ],
    });
    expect(() => assertGameProgressInvariants(snapshot, { variantId: "flh", scenarioId: "ACTION-002" })).not.toThrow();
  });

  test("ACTION-003 hero action buttons should be visible on hero turn", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "stud",
      currentActor: 0,
      players: [
        { seatIndex: 0, playerId: "hero", stack: 480, betThisStreet: 20, isTurn: true },
        { seatIndex: 1, playerId: "cpu-1", stack: 480, betThisStreet: 20 },
      ],
    });
    expect(() => assertGameProgressInvariants(snapshot, { variantId: "stud", scenarioId: "ACTION-003" })).not.toThrow();
  });

  test("ACTION-004 stale actingPlayerIndex should not override valid turn", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "stud",
      currentActor: 0,
      turn: 0,
      metadata: { actingPlayerIndex: 3 },
      players: [
        { seatIndex: 0, playerId: "hero", stack: 480, betThisStreet: 20 },
        { seatIndex: 1, playerId: "cpu-1", stack: 480, betThisStreet: 20 },
        { seatIndex: 2, playerId: "cpu-2", stack: 0, seatOut: true, folded: true },
        { seatIndex: 3, playerId: "cpu-3", stack: 0, seatOut: true, folded: true },
      ],
    });
    expect(() => assertGameProgressInvariants(snapshot, { variantId: "stud", scenarioId: "ACTION-004" })).not.toThrow();
  });

  test("ACTION-005 folded player should never receive turn", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "badugi",
      currentActor: 1,
      players: [
        { seatIndex: 0, playerId: "hero", stack: 480, betThisStreet: 20 },
        { seatIndex: 1, playerId: "folded-sb", stack: 490, betThisStreet: 10, folded: true, hasFolded: true },
        { seatIndex: 2, playerId: "bb", stack: 480, betThisStreet: 20 },
      ],
    });
    expectInvariantFailure(snapshot, /folded player received turn/, {
      variantId: "badugi",
      scenarioId: "ACTION-005",
    });
  });

  test("ACTION-006 eligible player with null actor should fail instead of freezing silently", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "plo",
      currentActor: null,
      turn: null,
      nextTurn: null,
      actingPlayerIndex: null,
      metadata: { actingPlayerIndex: null },
      players: [
        { seatIndex: 0, playerId: "hero", stack: 480, betThisStreet: 20 },
        { seatIndex: 1, playerId: "cpu-1", stack: 480, betThisStreet: 20 },
      ],
    });
    expectInvariantFailure(snapshot, /eligible player exists but no actor is set/, {
      variantId: "plo",
      scenarioId: "ACTION-006",
    });
  });

  test("ACTION-007 multiple UI turn flags should fail", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "nlh",
      currentActor: 0,
      players: [
        { seatIndex: 0, playerId: "hero", stack: 480, betThisStreet: 20, isTurn: true },
        { seatIndex: 1, playerId: "cpu-1", stack: 480, betThisStreet: 20, isTurn: true },
      ],
    });
    expectInvariantFailure(snapshot, /multiple players have isTurn=true/, {
      variantId: "nlh",
      scenarioId: "ACTION-007",
    });
  });

  test("ALLIN-001 all-in player should not be asked for betting action", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "badugi",
      currentActor: 1,
      players: [
        { seatIndex: 0, playerId: "hero", stack: 480, betThisStreet: 20 },
        { seatIndex: 1, playerId: "allin", stack: 0, betThisStreet: 20, allIn: true },
      ],
    });
    expectInvariantFailure(snapshot, /all-in player received betting turn|busted\/seat-out player received turn/, {
      variantId: "badugi",
      scenarioId: "ALLIN-001",
    });
  });

  test("ALLIN-002 heads-up all-in should reach showdown or terminal state", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "plo",
      phase: "SHOWDOWN",
      currentActor: null,
      lastHandResult: { winners: [{ seatIndex: 0, payout: 100 }] },
      players: [
        { seatIndex: 0, playerId: "hero", stack: 0, allIn: true },
        { seatIndex: 1, playerId: "cpu-1", stack: 0, allIn: true },
      ],
    });
    expect(() => assertGameProgressInvariants(snapshot, { variantId: "plo", scenarioId: "ALLIN-002" })).not.toThrow();
  });

  test("ALLIN-003 multiway all-in should not freeze", () => {
    const result = runProgressScenario({ variantId: "plo", scenarioId: "multiway-all-in", maxSteps: 120 });
    expect(result.status).toBe("passed");
  });

  test("DRAW-001 draw phase count should match variant draw count", () => {
    const result = runProgressScenario({
      variantId: "D01",
      scenarioId: "draw-count-full-cycle",
      invariantContext: { maxDrawRounds: 3, handCardCount: 5, maxDiscardCount: 5 },
      maxSteps: 180,
    });
    expect(result.status).toBe("passed");
  });

  test("DRAW-002 CPU draw should auto-resolve", () => {
    const result = runProgressScenario({
      variantId: "D02",
      scenarioId: "cpu-draw-auto-resolve",
      invariantContext: { maxDrawRounds: 3, handCardCount: 5, maxDiscardCount: 5 },
      maxSteps: 180,
    });
    expect(result.status).toBe("passed");
  });

  test("DRAW-003 already drawn player should not draw twice", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "D01",
      phase: "DRAW",
      currentActor: 0,
      players: [
        { seatIndex: 0, playerId: "hero", stack: 480, hand: ["2C", "3D", "4H", "5S", "7C"], hasDrawn: true },
        { seatIndex: 1, playerId: "cpu-1", stack: 480, hand: ["2D", "3C", "4S", "5H", "8C"] },
      ],
      handCardCount: 5,
      maxDiscardCount: 5,
    });
    expectInvariantFailure(snapshot, /already drawn player received draw turn/, {
      variantId: "D01",
      scenarioId: "DRAW-003",
    });
  });

  test("DRAW-004 hand size should remain valid after draw", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "D01",
      phase: "DRAW",
      currentActor: 1,
      handCardCount: 5,
      maxDiscardCount: 5,
      players: [
        { seatIndex: 0, playerId: "hero", stack: 480, hand: ["2C", "3D", "4H", "5S"], hasDrawn: true },
        { seatIndex: 1, playerId: "cpu-1", stack: 480, hand: ["2D", "3C", "4S", "5H", "8C"] },
      ],
    });
    expectInvariantFailure(snapshot, /hand size changed after draw/, {
      variantId: "D01",
      scenarioId: "DRAW-004",
    });
  });

  test("MTT-001 busted player should not receive turn", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "badugi",
      currentActor: 1,
      tournament: true,
      players: [
        { seatIndex: 0, playerId: "hero", stack: 500 },
        { seatIndex: 1, playerId: "busted", stack: 0, isBusted: true, seatOut: true },
      ],
    });
    expectInvariantFailure(snapshot, /busted\/seat-out player received turn/, {
      variantId: "badugi",
      scenarioId: "MTT-001",
      isTournament: true,
    });
  });

  test("MTT-002 CPU bust should not leave empty active table", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "badugi",
      tournament: true,
      currentActor: null,
      players: [
        { seatIndex: 0, playerId: "hero", stack: 0, isBusted: true, seatOut: true },
        { seatIndex: 1, playerId: "cpu-1", stack: 0, isBusted: true, seatOut: true },
      ],
    });
    expect(() => assertTournamentInvariants(snapshot, { variantId: "badugi", scenarioId: "MTT-002", isTournament: true })).toThrow(
      /no active players/,
    );
  });

  test("MTT-003 reseat/table merge should preserve playerId and stack", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "badugi",
      tournament: true,
      currentActor: 0,
      players: [
        { seatIndex: 0, playerId: "hero", stack: 500 },
        { seatIndex: 1, playerId: "hero", stack: 400 },
      ],
    });
    expect(() => assertTournamentInvariants(snapshot, { variantId: "badugi", scenarioId: "MTT-003", isTournament: true })).toThrow(
      /duplicate playerId/,
    );
  });

  test("MTT-004 tournament should reach valid terminal state", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "badugi",
      tournament: true,
      isFinished: true,
      currentActor: null,
      players: [
        { seatIndex: 0, playerId: "hero", stack: 1000, winner: true },
        { seatIndex: 1, playerId: "cpu-1", stack: 0, isBusted: true, seatOut: true },
      ],
    });
    expect(() => assertTournamentInvariants(snapshot, { variantId: "badugi", scenarioId: "MTT-004", isTournament: true })).not.toThrow();
  });
});
