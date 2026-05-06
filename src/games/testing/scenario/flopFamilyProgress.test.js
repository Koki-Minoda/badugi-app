import { describe, expect, test } from "vitest";
import { evaluatePloHand } from "../../plo/utils/ploEvaluator.js";
import { createProgressHarness, runProgressScenario } from "./runProgressScenario.js";
import { runVariantFamilyScenario, VARIANT_FAMILIES } from "./runVariantFamilyScenario.js";

describe("MGX Flop/Holdem/Omaha family progress coverage", () => {
  test("FLOP-001 blinds and preflop actor order are valid in 6-max board games", () => {
    const { controller } = createProgressHarness("B01");
    const snapshot = controller.getSnapshot();
    expect(snapshot.smallBlindIndex).toEqual(expect.any(Number));
    expect(snapshot.bigBlindIndex).toEqual(expect.any(Number));
    expect(snapshot.players[snapshot.smallBlindIndex].betThisStreet).toBeGreaterThan(0);
    expect(snapshot.players[snapshot.bigBlindIndex].betThisStreet).toBeGreaterThanOrEqual(
      snapshot.players[snapshot.smallBlindIndex].betThisStreet,
    );
    expect(snapshot.currentActor).not.toBe(snapshot.smallBlindIndex);
    expect(snapshot.currentActor).not.toBe(snapshot.bigBlindIndex);
  });

  test("FLOP-002 Hold'em family reaches terminal state without skipping board runout", () => {
    const result = runVariantFamilyScenario({
      family: VARIANT_FAMILIES.FLOP_HOLDEM,
      scenario: "cash-10-hands-smoke",
      seed: "flop-holdem-family",
      maxSteps: 260,
    });
    expect(result.failed).toEqual([]);
    expect(result.tested.length).toBeGreaterThanOrEqual(4);
  });

  test("FLOP-003 Omaha family all-in/runout smoke does not freeze", () => {
    const result = runVariantFamilyScenario({
      family: VARIANT_FAMILIES.FLOP_OMAHA,
      scenario: "multiway-all-in",
      seed: "flop-omaha-family",
      maxSteps: 260,
    });
    expect(result.failed).toEqual([]);
    expect(result.tested.length).toBeGreaterThanOrEqual(5);
  });

  test("OMAHA-001 Omaha evaluator records exactly two hole cards and three board cards", () => {
    const result = evaluatePloHand({
      holeCards: ["AS", "KS", "QD", "JD"],
      boardCards: ["AH", "AD", "AC", "2C", "3C"],
    });
    expect(result.mustUseHoleCards).toBe(2);
    expect(result.mustUseBoardCards).toBe(3);
    expect(result.holeCardsUsed).toHaveLength(2);
    expect(result.boardCardsUsed).toHaveLength(3);
  });

  test("SPLIT-001 split-pot board variants expose hi/lo split results", () => {
    const plo8 = runProgressScenario({
      variantId: "B06",
      scenarioId: "plo8-hi-lo-split",
      seed: "split-plo8",
      maxSteps: 260,
    });
    const flo8 = runProgressScenario({
      variantId: "B09",
      scenarioId: "flo8-hi-lo-split",
      seed: "split-flo8",
      maxSteps: 260,
    });
    expect(plo8.status).toBe("passed");
    expect(flo8.status).toBe("passed");
  });
});
