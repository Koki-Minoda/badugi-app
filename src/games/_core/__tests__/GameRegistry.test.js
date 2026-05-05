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

  it("returns NLH and PLO definitions by logical variant id", () => {
    expect(GameRegistry.get("nlh")?.label).toBe("No-Limit Hold'em");
    expect(GameRegistry.get("flh")?.label).toBe("Fixed-Limit Hold'em");
    expect(GameRegistry.get("super_holdem")?.handStructure).toMatchObject({
      hole: 3,
      community: 5,
    });
    expect(GameRegistry.get("fl_super_holdem")?.label).toBe("FL Super Hold'em");
    expect(GameRegistry.get("plo")?.label).toBe("Pot-Limit Omaha");
    expect(GameRegistry.get("plo8")?.label).toBe("PLO8");
    expect(GameRegistry.get("flo8")?.label).toBe("FLO8");
    expect(GameRegistry.get("plo")?.handStructure).toMatchObject({
      hole: 4,
      mustUseHole: 2,
      mustUseBoard: 3,
    });
    expect(GameRegistry.get("big_o")?.label).toBe("Big-O");
    expect(GameRegistry.get("five_card_plo")?.handStructure).toMatchObject({
      hole: 5,
      mustUseHole: 2,
      mustUseBoard: 3,
    });
    expect(GameRegistry.get("dramaha_hi")?.label).toBe("Dramaha Hi");
    expect(GameRegistry.get("dramaha_27")?.handStructure).toMatchObject({
      hole: 5,
      community: 3,
      mustUseHole: 2,
      mustUseBoard: 3,
    });
    expect(GameRegistry.get("stud")?.label).toBe("Stud");
    expect(GameRegistry.get("stud8")?.label).toBe("Stud 8");
    expect(GameRegistry.get("razz")?.label).toBe("Razz");
    expect(GameRegistry.get("razz27")?.label).toBe("2-7 Razz");
    expect(GameRegistry.get("razzdugi")?.label).toBe("Razzdugi");
    expect(GameRegistry.get("razzducey")?.label).toBe("Razzducey");
    expect(GameRegistry.get("chinese_poker")?.label).toBe("Chinese Poker");
  });
});
