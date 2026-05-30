import { describe, expect, test } from "vitest";
import {
  assertGameProgressInvariants,
  assertTournamentInvariants,
} from "../progress/gameProgressInvariants.js";
import { buildSyntheticSnapshot, runProgressScenario } from "../scenario/runProgressScenario.js";
import {
  findNextEligibleActor,
  getEligibleActorSeats,
  normalizeTurnState,
} from "../../core/turn/actorEligibility.js";
import { normalizeDiscardIndexes, normalizeDrawAction } from "../../core/draw/normalizeDrawAction.js";
import { DeuceToSevenTripleDrawController } from "../../draw/DeuceToSevenTripleDrawController.js";
import { AceToFiveTripleDrawController } from "../../draw/AceToFiveTripleDrawController.js";
import { DeuceToSevenSingleDrawController } from "../../draw/DeuceToSevenSingleDrawController.js";
import { AceToFiveSingleDrawController } from "../../draw/AceToFiveSingleDrawController.js";
import { BadugiGameController } from "../../badugi/BadugiGameController.js";
import { validateAction } from "../../badugi/engine/BadugiEngine.js";

function expectInvariantFailure(snapshot, match, context = {}) {
  expect(() => assertGameProgressInvariants(snapshot, context)).toThrow(match);
}

describe("MGX known game progress bug regressions", () => {
  test("TURN-001 SB fold should pass turn to BB or next eligible seat", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "badugi",
      currentBet: 20,
      players: [
        { seatIndex: 0, playerId: "btn", stack: 480, betThisStreet: 20, hasActedThisRound: true },
        { seatIndex: 1, playerId: "sb", stack: 490, betThisStreet: 10, folded: true, hasFolded: true },
        { seatIndex: 2, playerId: "bb", stack: 480, betThisStreet: 20, hasActedThisRound: false },
      ],
    });
    expect(findNextEligibleActor(snapshot, { phase: "BET", startIndex: 1 })).toBe(2);
  });

  test("TURN-002 BB option keeps betting round open", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "flh",
      currentBet: 20,
      players: [
        { seatIndex: 0, playerId: "btn", stack: 480, betThisStreet: 20, hasActedThisRound: true },
        { seatIndex: 1, playerId: "sb", stack: 490, betThisStreet: 20, hasActedThisRound: true },
        { seatIndex: 2, playerId: "bb", stack: 480, betThisStreet: 20, hasActedThisRound: false },
      ],
    });
    expect(getEligibleActorSeats(snapshot, { phase: "BET" })).toContain(2);
  });

  test("TURN-003 folded seat should not be selected as next actor", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "badugi",
      currentBet: 20,
      players: [
        { seatIndex: 0, playerId: "hero", stack: 480, betThisStreet: 20, hasActedThisRound: true },
        { seatIndex: 1, playerId: "folded", stack: 480, betThisStreet: 20, folded: true, hasFolded: true },
        { seatIndex: 2, playerId: "bb", stack: 480, betThisStreet: 20, hasActedThisRound: false },
      ],
    });
    expect(findNextEligibleActor(snapshot, { phase: "BET", startIndex: 1 })).toBe(2);
  });

  test("TURN-004 all-in seat should not be selected as BET actor", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "badugi",
      currentBet: 20,
      players: [
        { seatIndex: 0, playerId: "hero", stack: 480, betThisStreet: 20, hasActedThisRound: false },
        { seatIndex: 1, playerId: "allin", stack: 0, betThisStreet: 20, allIn: true },
      ],
    });
    expect(findNextEligibleActor(snapshot, { phase: "BET", startIndex: 1 })).toBe(0);
  });

  test("TURN-005 eligible seat with null actor fails instead of freezing", () => {
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
      scenarioId: "TURN-005",
    });
  });

  test("TURN-006 stale metadata actingPlayerIndex does not override authoritative actor", () => {
    const normalized = normalizeTurnState(
      buildSyntheticSnapshot({
        variantId: "stud",
        currentActor: 0,
        actingPlayerIndex: 0,
        turn: 0,
        nextTurn: 0,
        metadata: { actingPlayerIndex: 3 },
        players: [
          { seatIndex: 0, playerId: "hero", stack: 480, betThisStreet: 20 },
          { seatIndex: 1, playerId: "cpu-1", stack: 480, betThisStreet: 20 },
          { seatIndex: 2, playerId: "cpu-2", stack: 0, seatOut: true },
          { seatIndex: 3, playerId: "cpu-3", stack: 0, seatOut: true },
        ],
      }),
      { phase: "BET" },
    );
    expect(normalized.currentActor).toBe(0);
    expect(normalized.metadata.actingPlayerIndex).toBe(0);
    expect(normalized.players.filter((player) => player.isTurn)).toHaveLength(1);
    expect(normalized.players[0].isTurn).toBe(true);
  });

  test("TURN-007 normalizeTurnState rebuilds players.isTurn from one actor", () => {
    const normalized = normalizeTurnState(
      buildSyntheticSnapshot({
        currentActor: 1,
        actingPlayerIndex: 1,
        turn: 1,
        nextTurn: 1,
        players: [
          { seatIndex: 0, playerId: "hero", stack: 480, isTurn: true },
          { seatIndex: 1, playerId: "cpu-1", stack: 480, isTurn: true },
        ],
      }),
      { phase: "BET" },
    );
    expect(normalized.players.map((player) => Boolean(player.isTurn))).toEqual([false, true]);
  });

  test("TURN-008 DRAW actor must be inside pendingDrawSeats", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "D01",
      phase: "DRAW",
      currentActor: 0,
      pendingDrawSeats: [1],
      players: [
        { seatIndex: 0, playerId: "hero", stack: 480, hand: ["2C", "3D", "4H", "5S", "7C"] },
        { seatIndex: 1, playerId: "cpu-1", stack: 480, hand: ["2D", "3C", "4S", "5H", "8C"] },
      ],
    });
    expectInvariantFailure(snapshot, /draw actor is not in pendingDrawSeats/, {
      variantId: "D01",
      scenarioId: "TURN-008",
    });
  });

  test("TURN-009 already drawn seat should not be selected for DRAW again", () => {
    const snapshot = buildSyntheticSnapshot({
      variantId: "D01",
      phase: "DRAW",
      pendingDrawSeats: [0, 1],
      players: [
        { seatIndex: 0, playerId: "hero", stack: 480, hasDrawn: true },
        { seatIndex: 1, playerId: "cpu-1", stack: 480 },
      ],
    });
    expect(findNextEligibleActor(snapshot, { phase: "DRAW", startIndex: 0 })).toBe(1);
  });

  test("TURN-010 draw family fixed-limit actor paths still complete one hand", () => {
    for (const variantId of ["D01", "D02", "S01", "S02"]) {
      const result = runProgressScenario({
        variantId,
        scenarioId: "turn-010-draw-family-actor-path",
        invariantContext: { maxDrawRounds: variantId.startsWith("S") ? 1 : 3, handCardCount: 5, maxDiscardCount: 5 },
        maxSteps: 180,
      });
      expect(result.status, `${variantId} should complete via unified actor helpers`).toBe("passed");
    }
  });

  test("TURN-011 all-in seat is excluded from BET actor selection (asymmetry with DRAW)", () => {
    // Regression: isSeatEligibleForBetting excludes all-in seats regardless of stack value.
    // Old or duplicated predicates could accidentally select the all-in player for BET.
    // See NOTE (H-01-2) in actionUtils.js.
    const snapshot = buildSyntheticSnapshot({
      variantId: "badugi",
      currentBet: 20,
      players: [
        { seatIndex: 0, playerId: "hero",  stack: 300, betThisStreet: 20, hasActedThisRound: true },
        { seatIndex: 1, playerId: "allin", stack: 0,   betThisStreet: 20, allIn: true },
        { seatIndex: 2, playerId: "cpu-2", stack: 200, betThisStreet: 0,  hasActedThisRound: false },
      ],
    });
    // Searching from the all-in seat must skip it and land on seat 2.
    expect(findNextEligibleActor(snapshot, { phase: "BET", startIndex: 1 })).toBe(2);
    // All-in seat must not appear in the BET eligible set.
    expect(getEligibleActorSeats(snapshot, { phase: "BET" })).not.toContain(1);
  });

  test("TURN-012 all-in seat is included in DRAW actor selection when hasDrawn=false, excluded after hasDrawn=true", () => {
    // Regression (TDA-style asymmetry, NOTE H-01-2):
    // All-in players may still take pat/draw decisions — the only DRAW gate is hasDrawn.
    // Old code excluded all-in from DRAW the same way it excluded them from BET.
    const activePlayers = [
      { seatIndex: 0, playerId: "hero",  stack: 300, allIn: false, folded: false, hasDrawn: true,  hasActedThisRound: true  },
      { seatIndex: 1, playerId: "allin", stack: 0,   allIn: true,  folded: false, hasDrawn: false, hasActedThisRound: false },
      { seatIndex: 2, playerId: "cpu-2", stack: 200, allIn: false, folded: false, hasDrawn: false, hasActedThisRound: false },
    ];
    const snapshot = buildSyntheticSnapshot({ variantId: "badugi", phase: "DRAW", players: activePlayers });

    // All-in with hasDrawn=false must be next (comes before cpu-2 from seat 0).
    expect(findNextEligibleActor(snapshot, { phase: "DRAW", startIndex: 0, allowAllInDraw: true })).toBe(1);

    // After the all-in player draws, it must be skipped and cpu-2 becomes the actor.
    const afterDraw = buildSyntheticSnapshot({
      variantId: "badugi",
      phase: "DRAW",
      players: activePlayers.map((player) =>
        player.seatIndex === 1 ? { ...player, hasDrawn: true } : player,
      ),
    });
    expect(findNextEligibleActor(afterDraw, { phase: "DRAW", startIndex: 0, allowAllInDraw: true })).toBe(2);
  });

  test("TURN-013 advanceStreet resets raiseCountThisRound to 0 when the bet round closes", () => {
    // Risk: raiseCountThisRound leaking into the next round would incorrectly
    // suppress raises, miscompute reopen logic, or freeze betting progression.
    // D-04 / actor-unification work increased sensitivity around betting-round
    // carry-over because the consolidated actor path relies on a clean
    // raiseCountThisRound at round start.
    const ctrl = new BadugiGameController({ blindStructure: [] });

    // Simulate 3 raises having occurred in the current betting round.
    ctrl.syncExternalState({
      raiseCountThisRound: 3,
      raiseCap: 4,
      drawRound: 0,
      currentBet: 60,
      dealerIdx: 0,
      players: [
        {
          seatIndex: 0, playerId: "hero",  stack: 440, betThisRound: 60,
          hasActedThisRound: true, folded: false, allIn: false,
          isSeated: true, isActiveInGame: true,
        },
        {
          seatIndex: 1, playerId: "cpu-1", stack: 440, betThisRound: 60,
          hasActedThisRound: true, folded: false, allIn: false,
          isSeated: true, isActiveInGame: true,
        },
      ],
    });

    expect(ctrl.state.raiseCountThisRound).toBe(3);

    // Both players have acted and bets match — the round must close.
    const snap = ctrl.advanceStreet({
      players:         ctrl.state.players,
      actedIndex:      1,
      dealerIdx:       ctrl.state.dealerIdx,
      drawRound:       ctrl.state.drawRound,
      betHead:         ctrl.state.betHead,
      lastAggressorIdx: ctrl.state.lastAggressorIdx,
    });

    expect(snap.shouldAdvance).toBe(true);
    // After the round closes, the carry-over count must be zero.
    expect(ctrl.state.raiseCountThisRound).toBe(0);
  });

  test("TURN-014 after street advance, RAISE is not blocked by stale raiseCountThisRound", () => {
    // Risk: if raiseCountThisRound were not reset on street advance, a cap=4
    // state from the previous round would reject all raises in the new round.
    // validateAction reads raiseCountThisRound from table.metadata — this test
    // confirms that the pre-reset value (4 == cap) blocks RAISE and the
    // post-reset value (0) allows it.
    const betSize = 20;

    // Build a minimal betting-round table snapshot with the given raise count.
    const makeBettingTable = (raiseCountThisRound) => ({
      players: [
        {
          seatIndex: 0, playerId: "hero",
          stack: 500, betThisRound: 0,
          hasActedThisRound: false, folded: false, allIn: false,
          isSeated: true, isActiveInGame: true,
        },
      ],
      bigBlind: betSize,
      smallBlind: betSize / 2,
      drawRoundIndex: 0,
      betRoundIndex: 0,
      metadata: { raiseCountThisRound, raiseCap: 4, bbValue: betSize },
    });

    // Pre-reset state: cap is reached — RAISE must be blocked.
    const capHit = validateAction(makeBettingTable(4), 0, { type: "RAISE" });
    expect(capHit.isValid).toBe(false);
    expect(capHit.code).toBe("FL_RAISE_CAP");

    // Post-reset state: count back to 0 — RAISE must be allowed.
    const afterReset = validateAction(makeBettingTable(0), 0, { type: "RAISE" });
    expect(afterReset.isValid).toBe(true);
  });

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

  test("DRAW-SOT-001 draw afterHand is preserved in next snapshot", () => {
    const controller = new DeuceToSevenTripleDrawController();
    let state = controller.createInitialState();
    state = controller.createNewHandState(state, { handId: "draw-sot-001" });
    let snapshot = state.snapshot;
    let guard = 0;
    while (snapshot.phase !== "DRAW" && guard < 30) {
      const actor = snapshot.actingPlayerIndex;
      const actions = controller.getLegalActions(state, actor);
      const type = actions.some((action) => action.type === "CHECK") ? "CHECK" : "CALL";
      state = controller.applyAction(state, { seatIndex: actor, type }).state;
      snapshot = state.snapshot;
      guard += 1;
    }
    expect(snapshot.phase).toBe("DRAW");
    const actor = snapshot.actingPlayerIndex;
    const before = [...snapshot.players[actor].hand];
    state = controller.applyAction(state, {
      seatIndex: actor,
      type: "DRAW",
      discardIndexes: [0, 1],
    }).state;
    const afterDraw = state.snapshot.players[actor].hand;
    expect(afterDraw).toHaveLength(5);
    expect(afterDraw).not.toEqual(before);
    const lastDraw = state.snapshot.metadata.lastDrawAction;
    expect(lastDraw.beforeHand).toEqual(before);
    expect(lastDraw.afterHand).toEqual(afterDraw);
    expect(lastDraw.discardIndexes).toEqual([0, 1]);
  });

  test("DRAW-SOT-002 drawRoundIndex never decreases across draw family progressions", () => {
    for (const variantId of ["D01", "D02", "S01", "S02"]) {
      const result = runProgressScenario({
        variantId,
        scenarioId: `draw-sot-002-${variantId}`,
        invariantContext: { maxDrawRounds: variantId.startsWith("S") ? 1 : 3, handCardCount: 5, maxDiscardCount: 5 },
        maxSteps: 180,
      });
      expect(result.status).toBe("passed");
    }
  });

  test("DRAW-SOT-003 discardIndexes are authoritative over mismatched drawCount", () => {
    const normalized = normalizeDiscardIndexes({
      hand: ["2C", "3D", "4H", "5S", "7C"],
      discardIndexes: [3, 1],
      drawCount: 5,
      maxDiscardCount: 5,
    });
    expect(normalized.discardIndexes).toEqual([1, 3]);
    expect(normalized.drawCount).toBe(2);
    expect(normalized.warnings.map((warning) => warning.code)).toContain("DRAW_COUNT_MISMATCH");
  });

  test("DRAW-SOT-004 discardIndexes duplicates are invalid", () => {
    expect(() =>
      normalizeDiscardIndexes({
        hand: ["2C", "3D", "4H", "5S", "7C"],
        discardIndexes: [0, 0],
        maxDiscardCount: 5,
      }),
    ).toThrow(/unique/);
  });

  test("DRAW-SOT-005 discardIndexes out of range are invalid", () => {
    expect(() =>
      normalizeDiscardIndexes({
        hand: ["2C", "3D", "4H", "5S", "7C"],
        discardIndexes: [5],
        maxDiscardCount: 5,
      }),
    ).toThrow(/out-of-range/);
  });

  test("DRAW-SOT-006 pat normalizes to empty discardIndexes", () => {
    const normalized = normalizeDrawAction({
      action: { type: "DRAW", discardIndexes: [] },
      player: { hand: ["2C", "3D", "4H", "5S", "7C"] },
      state: { maxDiscardCount: 5 },
    });
    expect(normalized.discardIndexes).toEqual([]);
    expect(normalized.drawCount).toBe(0);
    expect(normalized.pat).toBe(true);
  });

  test("DRAW-SOT-007 Badugi discard upper bound is four", () => {
    expect(() =>
      normalizeDiscardIndexes({
        hand: ["AC", "2D", "3H", "4S"],
        drawCount: 5,
        maxDiscardCount: 4,
      }),
    ).toThrow(/drawCount is outside/);
  });

  test("DRAW-SOT-008 D01/D02/S01/S02 discard upper bound is five", () => {
    const normalized = normalizeDiscardIndexes({
      hand: ["2C", "3D", "4H", "5S", "7C"],
      drawCount: 5,
      maxDiscardCount: 5,
    });
    expect(normalized.discardIndexes).toEqual([0, 1, 2, 3, 4]);
  });

  test("DRAW-SOT-009 S01/S02 draw only once", () => {
    for (const variantId of ["S01", "S02"]) {
      const result = runProgressScenario({
        variantId,
        scenarioId: `draw-sot-009-${variantId}`,
        invariantContext: { maxDrawRounds: 1, handCardCount: 5, maxDiscardCount: 5 },
        maxSteps: 100,
      });
      expect(result.status).toBe("passed");
      expect([...new Set(result.drawRoundIndexes)]).toEqual([1]);
    }
  });

  test("DRAW-SOT-010 CPU draw clears pendingDrawSeats", () => {
    const result = runProgressScenario({
      variantId: "D02",
      scenarioId: "draw-sot-010-cpu-draw-pending",
      invariantContext: { maxDrawRounds: 3, handCardCount: 5, maxDiscardCount: 5 },
      maxSteps: 180,
    });
    expect(result.status).toBe("passed");
  });

  test("DRAW-SOT-011 drawn seat is removed from pending draw queue", () => {
    const controller = new AceToFiveTripleDrawController();
    let state = controller.createInitialState();
    state = controller.createNewHandState(state, { handId: "draw-sot-011" });
    let snapshot = state.snapshot;
    let guard = 0;
    while (snapshot.phase !== "DRAW" && guard < 30) {
      const actor = snapshot.actingPlayerIndex;
      const actions = controller.getLegalActions(state, actor);
      const type = actions.some((action) => action.type === "CHECK") ? "CHECK" : "CALL";
      state = controller.applyAction(state, { seatIndex: actor, type }).state;
      snapshot = state.snapshot;
      guard += 1;
    }
    const actor = snapshot.actingPlayerIndex;
    state = controller.applyAction(state, {
      seatIndex: actor,
      type: "DRAW",
      drawCount: 1,
    }).state;
    expect(state.snapshot.metadata.pendingDrawSeats).not.toContain(actor);
  });

  test("DRAW-SOT-012 old snapshot with smaller drawRoundIndex is rejected by invariant context", () => {
    const previousSnapshot = buildSyntheticSnapshot({
      variantId: "D01",
      phase: "DRAW",
      drawRoundIndex: 2,
      players: [{ seatIndex: 0, playerId: "hero", stack: 480, hand: ["2C", "3D", "4H", "5S", "7C"] }],
    });
    const staleSnapshot = buildSyntheticSnapshot({
      variantId: "D01",
      phase: "DRAW",
      drawRoundIndex: 1,
      players: [{ seatIndex: 0, playerId: "hero", stack: 480, hand: ["2C", "3D", "4H", "5S", "7C"] }],
    });
    expectInvariantFailure(staleSnapshot, /draw round index decreased/, {
      variantId: "D01",
      scenarioId: "DRAW-SOT-012",
      previousSnapshot,
    });
  });

  test("DRAW-SOT-013 action log drawInfo fields are present in draw controller metadata", () => {
    const controller = new DeuceToSevenSingleDrawController();
    let state = controller.createInitialState();
    state = controller.createNewHandState(state, { handId: "draw-sot-013" });
    let snapshot = state.snapshot;
    let guard = 0;
    while (snapshot.phase !== "DRAW" && guard < 30) {
      const actor = snapshot.actingPlayerIndex;
      const actions = controller.getLegalActions(state, actor);
      const type = actions.some((action) => action.type === "CHECK") ? "CHECK" : "CALL";
      state = controller.applyAction(state, { seatIndex: actor, type }).state;
      snapshot = state.snapshot;
      guard += 1;
    }
    const actor = snapshot.actingPlayerIndex;
    state = controller.applyAction(state, { seatIndex: actor, type: "DRAW", discardIndexes: [] }).state;
    const lastDraw = state.snapshot.metadata.lastDrawAction;
    expect(lastDraw).toMatchObject({
      seatIndex: actor,
      discardIndexes: [],
      drawCount: 0,
      discardedCards: [],
      replacementCards: [],
    });
    expect(lastDraw.beforeHand).toHaveLength(5);
    expect(lastDraw.afterHand).toHaveLength(5);
  });

  test("DRAW-SOT-014 RL/replay drawCount-only action is normalized deterministically", () => {
    const controller = new AceToFiveSingleDrawController();
    let state = controller.createInitialState();
    state = controller.createNewHandState(state, { handId: "draw-sot-014" });
    let snapshot = state.snapshot;
    let guard = 0;
    while (snapshot.phase !== "DRAW" && guard < 30) {
      const actor = snapshot.actingPlayerIndex;
      const actions = controller.getLegalActions(state, actor);
      const type = actions.some((action) => action.type === "CHECK") ? "CHECK" : "CALL";
      state = controller.applyAction(state, { seatIndex: actor, type }).state;
      snapshot = state.snapshot;
      guard += 1;
    }
    const actor = snapshot.actingPlayerIndex;
    state = controller.applyAction(state, { seatIndex: actor, type: "DRAW", drawCount: 2 }).state;
    expect(state.snapshot.metadata.lastDrawAction.discardIndexes).toEqual([0, 1]);
    expect(state.snapshot.metadata.lastDrawAction.drawCount).toBe(2);
  });

  test("DRAW-SOT-015 D01 minimal all-in progression reaches result without freeze", () => {
    const controller = new DeuceToSevenTripleDrawController({
      tableConfig: {
        seatConfig: ["HUMAN", "CPU", "CPU"],
        startingStack: 10,
        structure: { sb: 5, bb: 10, ante: 0 },
      },
    });
    let state = controller.createInitialState();
    state = controller.createNewHandState(state, { handId: "draw-sot-015" });
    let observedAllInDrew = false;

    for (let guard = 0; guard < 100 && !state.snapshot.lastHandResult; guard += 1) {
      const snapshot = state.snapshot;
      const actor = [snapshot.actingPlayerIndex, snapshot.currentActor, snapshot.turn, snapshot.nextTurn]
        .find((candidate) => typeof candidate === "number");
      if (typeof actor !== "number") {
        throw new Error(`DRAW-SOT-015 missing actor before terminal: ${JSON.stringify({
          phase: snapshot.phase,
          handId: snapshot.handId,
          lastHandResult: Boolean(snapshot.lastHandResult),
          actingPlayerIndex: snapshot.actingPlayerIndex,
          currentActor: snapshot.currentActor,
          turn: snapshot.turn,
          nextTurn: snapshot.nextTurn,
          players: snapshot.players.map((player) => ({
            seatIndex: player.seatIndex,
            stack: player.stack,
            allIn: player.allIn,
            folded: player.folded,
            hasDrawn: player.hasDrawn,
            lastAction: player.lastAction,
          })),
        })}`);
      }

      const legalActions = controller.getLegalActions(state, actor);
      const legalTypes = legalActions.map((action) => action.type);
      if (snapshot.phase === "BET") {
        const type = legalTypes.includes("CHECK") ? "CHECK" : "CALL";
        if (!legalTypes.includes(type)) {
          throw new Error(`DRAW-SOT-015 missing BET action: ${JSON.stringify({ actor, legalTypes, snapshot })}`);
        }
        state = controller.applyAction(state, { seatIndex: actor, type }).state;
        if (state.snapshot?.players?.some((player) => player.allIn && player.hasDrawn === true)) {
          observedAllInDrew = true;
        }
        continue;
      }
      if (snapshot.phase === "DRAW") {
        if (!legalTypes.includes("DRAW")) {
          throw new Error(`DRAW-SOT-015 missing DRAW action: ${JSON.stringify({ actor, legalTypes, snapshot })}`);
        }
        state = controller.applyAction(state, { seatIndex: actor, type: "DRAW", discardIndexes: [] }).state;
        if (state.snapshot?.players?.some((player) => player.allIn && player.hasDrawn === true)) {
          observedAllInDrew = true;
        }
        continue;
      }
      throw new Error(`DRAW-SOT-015 unexpected non-terminal phase: ${snapshot.phase}`);
    }

    expect(state.snapshot.lastHandResult).toBeTruthy();
    expect(state.snapshot.players.reduce((sum, player) => sum + Number(player.stack ?? 0), 0)).toBe(30);
    expect(observedAllInDrew).toBe(true);
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
