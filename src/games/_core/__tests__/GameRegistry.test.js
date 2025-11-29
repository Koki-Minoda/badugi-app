import { describe, it, expect } from "vitest";
import GameRegistry from "../../_core/GameRegistry";
import { evaluateBadugi } from "../../badugi/utils/badugiEvaluator";

describe("GameRegistry", () => {
  it("returns badugi definition", () => {
    const def = GameRegistry.get("badugi");
    expect(def).toBeTruthy();
    expect(def.variant).toBe("badugi");
    expect(def.label).toBe("Badugi");
  });

  it("uses badugi evaluator for evaluateHand", () => {
    const def = GameRegistry.get("badugi");
    const sampleHand = ["As", "2d", "3c", "4h"];
    expect(def.evaluateHand(sampleHand)).toEqual(evaluateBadugi(sampleHand));
  });
});
