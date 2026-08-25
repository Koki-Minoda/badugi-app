import { test, expect } from "@playwright/test";
import { assertBrowserGameplayInvariants } from "../../src/ui/qa/assertBrowserGameplayInvariants.js";

test("impossible transition detector rejects DRAW/BET mixed snapshots", async () => {
  const result = assertBrowserGameplayInvariants({
    variantId: "badugi",
    handId: "mixed",
    phase: "DRAW",
    drawRound: 1,
    betRound: 1,
    buttonSeat: 0,
    bbSeat: 2,
    controller: {
      actorSeat: 0,
      nextTurn: 0,
      currentBet: 20,
      pot: 60,
      players: [
        { stack: 500, betThisRound: 0, hasActedThisRound: false },
        { stack: 500, betThisRound: 0, hasActedThisRound: false },
      ],
    },
    ui: {
      heroSeat: 0,
      heroControlsVisible: true,
      bettingControlsVisible: true,
      drawControlsVisible: false,
      visibleActions: ["action-raise"],
      displayedPhase: "DRAW",
    },
    mergeSource: {
      controller: { source: "state.controllerSnapshot", phase: "DRAW", actor: 0, drawRound: 1 },
      session: { phase: "DRAW", actor: 0, drawRound: 1 },
      legacy: { phase: "DRAW", actor: 0, drawRound: 1 },
      mergedPhase: "DRAW",
      mergedActor: 0,
    },
  }, []);

  expect(result.violations.map((violation) => violation.type)).toContain("DRAW_BET_MIXED_STATE");
});

test("impossible transition detector rejects terminal actors", async () => {
  const result = assertBrowserGameplayInvariants({
    variantId: "D01",
    handId: "terminal",
    phase: "RESULT",
    drawRound: 3,
    betRound: 4,
    controller: {
      actorSeat: 0,
      nextTurn: 0,
      currentBet: 0,
      pot: 0,
      players: [{ stack: 500 }],
    },
    ui: {
      heroSeat: 0,
      heroControlsVisible: false,
      visibleActions: [],
      displayedPhase: "RESULT",
      resultVisible: true,
    },
    mergeSource: {
      controller: { source: "state.controllerSnapshot", phase: "RESULT", actor: 0, drawRound: 3 },
      session: { phase: "RESULT", actor: 0, drawRound: 3 },
      legacy: { phase: "RESULT", actor: 0, drawRound: 3 },
      mergedPhase: "RESULT",
      mergedActor: 0,
    },
  }, []);

  expect(result.violations.map((violation) => violation.type)).toContain("TERMINAL_WITH_ACTOR");
});
