import { describe, expect, test } from "vitest";
import { createProgressHarness, runProgressScenario } from "./runProgressScenario.js";
import { runVariantFamilyScenario, VARIANT_FAMILIES } from "./runVariantFamilyScenario.js";

const STUD_VARIANTS = ["ST1", "ST2", "ST3", "ST4", "ST5", "ST6"];

describe("MGX Stud family progress coverage", () => {
  test.each(STUD_VARIANTS)("STUD-001 %s ante / bring-in is posted and next actor is valid", (variantId) => {
    const { controller } = createProgressHarness(variantId);
    const snapshot = controller.getSnapshot();
    const activePlayers = snapshot.players.filter((player) => !player.seatOut && !player.folded);
    const anteTotal = activePlayers.length * 2;
    expect(snapshot.bringInIndex).toEqual(expect.any(Number));
    expect(snapshot.bringInAmount).toBeGreaterThan(0);
    expect(snapshot.pot).toBe(anteTotal + snapshot.bringInAmount);
    expect(snapshot.players[snapshot.bringInIndex].lastAction).toMatch(/Bring-in/);
    expect(snapshot.currentActor).not.toBe(snapshot.bringInIndex);
    expect(snapshot.players[snapshot.currentActor]?.folded).not.toBe(true);
  });

  test("STUD-002 Stud variants progress without street freeze", () => {
    const result = runVariantFamilyScenario({
      family: VARIANT_FAMILIES.STUD,
      scenario: "cash-10-hands-smoke",
      seed: "stud-family-street-progression",
      maxSteps: 320,
    });
    expect(result.failed).toEqual([]);
    expect(result.tested.map((entry) => entry.variantId).sort()).toEqual([...STUD_VARIANTS].sort());
  });

  test("STUD-003 folded player is not dealt on later streets", () => {
    const { controller } = createProgressHarness("ST1");
    controller.state.players[1].folded = true;
    controller.state.players[1].hasFolded = true;
    const before = controller.state.players[1].holeCards.length;
    controller.advanceStreet();
    expect(controller.state.players[1].holeCards).toHaveLength(before);
  });

  test("STUD-004 all-in state reaches showdown or a valid terminal state", () => {
    const result = runProgressScenario({
      variantId: "ST1",
      scenarioId: "heads-up-all-in",
      seed: "stud-family-all-in",
      maxSteps: 320,
    });
    expect(result.status).toBe("passed");
  });

  test.each([
    ["ST2", "hi-lo-8-split"],
    ["ST3", "low-a5"],
    ["ST6", "low-27"],
  ])("STUD-005 %s evaluator family is configured as %s", (variantId, expectedEvaluator) => {
    const { controller } = createProgressHarness(variantId);
    const evaluators = controller.config.gameDefinition?.evaluators ?? [];
    expect(evaluators).toContain(expectedEvaluator);
  });

  test("STUD-006 heads-up and six-max Stud/Razz smoke do not freeze", () => {
    const sixMaxStud = runProgressScenario({
      variantId: "ST1",
      scenarioId: "stud-six-max",
      seed: "stud-six-max",
      maxSteps: 320,
    });
    const sixMaxRazz = runProgressScenario({
      variantId: "ST3",
      scenarioId: "razz-six-max",
      seed: "razz-six-max",
      maxSteps: 320,
    });
    expect(sixMaxStud.status).toBe("passed");
    expect(sixMaxRazz.status).toBe("passed");
  });
});
