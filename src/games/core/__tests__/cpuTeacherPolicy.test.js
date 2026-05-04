import { describe, expect, it } from "vitest";
import {
  chooseTeacherBetAction,
  estimateBoardHandStrength,
  estimateStudHandStrength,
} from "../cpuTeacherPolicy.js";

describe("cpuTeacherPolicy", () => {
  it("rewards premium board-game starts before board cards are dealt", () => {
    const strength = estimateBoardHandStrength({
      holeCards: ["AS", "AH"],
      variantId: "game-nlh",
    });

    expect(strength).toBeGreaterThan(0.8);
  });

  it("recognizes coordinated Omaha starts independent of variant id casing", () => {
    const lowerCaseStrength = estimateBoardHandStrength({
      holeCards: ["AS", "KS", "QD", "JD"],
      variantId: "game-plo",
    });
    const upperCaseStrength = estimateBoardHandStrength({
      holeCards: ["AS", "KS", "QD", "JD"],
      variantId: "PLO",
    });

    expect(lowerCaseStrength).toBeGreaterThan(0.65);
    expect(lowerCaseStrength).toBeCloseTo(upperCaseStrength, 4);
  });

  it("keeps Razz-family low-card starts above passive trash", () => {
    const strongLow = estimateStudHandStrength({
      holeCards: ["AS", "2D", "4C"],
      upCards: ["4C"],
      variant: "razz",
    });
    const weakLow = estimateStudHandStrength({
      holeCards: ["KS", "QD", "JC"],
      upCards: ["JC"],
      variant: "razz",
    });

    expect(strongLow).toBeGreaterThan(weakLow);
  });

  it("folds weak calls and value-raises strong hands by tier thresholds", () => {
    expect(
      chooseTeacherBetAction({
        strength: 0.2,
        toCall: 20,
        canRaise: true,
        tierConfig: { id: "standard" },
        betAmount: 40,
      }).type,
    ).toBe("FOLD");
    expect(
      chooseTeacherBetAction({
        strength: 0.9,
        toCall: 20,
        canRaise: true,
        tierConfig: { id: "standard" },
        betAmount: 40,
      }).type,
    ).toBe("RAISE");
  });
});
