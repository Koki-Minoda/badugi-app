import { describe, expect, test } from "vitest";
import { evaluateLowHand } from "../../evaluators/low.js";
import { runProgressScenario } from "./runProgressScenario.js";
import { runVariantFamilyScenario, VARIANT_FAMILIES } from "./runVariantFamilyScenario.js";

describe("MGX draw family progress coverage", () => {
  test("DRAW-FAMILY-001 draw count matches configured draw rounds across draw variants", () => {
    const result = runVariantFamilyScenario({
      family: VARIANT_FAMILIES.DRAW,
      scenario: "draw-count-full-cycle",
      seed: "draw-family-count",
      maxSteps: 260,
    });
    expect(result.failed).toEqual([]);
    expect(result.tested.length).toBeGreaterThanOrEqual(10);
  });

  test("DRAW-FAMILY-002 2-7 and A-5 lowball evaluators do not cross wires", () => {
    const wheel = ["AS", "2D", "3C", "4H", "5S"];
    const sevenLow = ["2S", "3D", "4C", "5H", "7S"];
    const a5Eval = evaluateLowHand({ cards: wheel, lowType: "A5" });
    const deuceEval = evaluateLowHand({ cards: sevenLow, lowType: "27" });
    expect(a5Eval.handName).toBe("A-5 Low");
    expect(deuceEval.handName).toBe("2-7 Low");
    expect(a5Eval.metadata.ranks).toEqual([5, 4, 3, 2, 1]);
    expect(deuceEval.metadata.ranks).toEqual([7, 5, 4, 3, 2]);
  });

  test.each(["D04", "D05", "S05", "S06"])(
    "DRAW-FAMILY-003 %s split draw game reaches component result without freeze",
    (variantId) => {
      const result = runProgressScenario({
        variantId,
        scenarioId: "split-draw-component",
        seed: `split-draw-${variantId}`,
        maxSteps: 260,
        invariantContext: { enforceHandSize: true },
      });
      expect(result.status).toBe("passed");
    },
  );
});
