import { describe, expect, it } from "vitest";
import {
  chooseTeacherBetAction,
  estimateBoardHandStrength,
  estimateNlhPreflopRangeScore,
  estimateOmahaPreflopRangeScore,
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

  it("uses position-sensitive NLH preflop range scores", () => {
    const utgA5s = estimateNlhPreflopRangeScore({
      holeCards: ["AS", "5S"],
      position: "UTG",
    });
    const buttonA5s = estimateNlhPreflopRangeScore({
      holeCards: ["AS", "5S"],
      position: "BTN",
    });
    const buttonTrash = estimateNlhPreflopRangeScore({
      holeCards: ["7C", "2D"],
      position: "BTN",
    });

    expect(buttonA5s).toBeGreaterThan(utgA5s);
    expect(buttonA5s).toBeGreaterThan(buttonTrash);
  });

  it("prioritizes PLO nut potential and PLO8 scoop starts over disconnected hands", () => {
    const connectedPlo = estimateOmahaPreflopRangeScore({
      holeCards: ["AS", "KS", "QD", "JD"],
      variantId: "B05",
      position: "CO",
    });
    const disconnectedPlo = estimateOmahaPreflopRangeScore({
      holeCards: ["KC", "9D", "6H", "2S"],
      variantId: "B05",
      position: "CO",
    });
    const scoopPlo8 = estimateOmahaPreflopRangeScore({
      holeCards: ["AS", "2S", "KH", "KD"],
      variantId: "B06",
      position: "MP",
    });

    expect(connectedPlo).toBeGreaterThan(disconnectedPlo);
    expect(scoopPlo8).toBeGreaterThan(0.7);
  });

  it("folds below-position preflop range and opens playable late-position board hands", () => {
    expect(
      chooseTeacherBetAction({
        strength: 0.58,
        toCall: 0,
        canRaise: true,
        tierConfig: { id: "standard" },
        street: "PREFLOP",
        variantId: "B01",
        position: "UTG",
      }).type,
    ).toBe("CHECK");
    expect(
      chooseTeacherBetAction({
        strength: 0.58,
        toCall: 0,
        canRaise: true,
        tierConfig: { id: "standard" },
        street: "PREFLOP",
        variantId: "B01",
        position: "BTN",
      }).type,
    ).toBe("BET");
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
