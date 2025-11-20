import { describe, expect, it } from "vitest";
import { getProRulesForVariant } from "../proRules.js";

describe("getProRulesForVariant", () => {
  it("returns stud defaults with bring-in requirement", () => {
    const rules = getProRulesForVariant("ST1");
    expect(rules.requiresBringIn).toBe(true);
    expect(rules.killBlind).toBeNull();
  });

  it("merges board defaults with overrides", () => {
    const rules = getProRulesForVariant("B06");
    expect(rules.killBlind).toEqual(
      expect.objectContaining({
        minPotBigBlinds: 10,
        multiplier: 2,
        triggerConsecutiveWins: 2,
      })
    );
  });

  it("disables kill blind when override is null", () => {
    const rules = getProRulesForVariant("S01");
    expect(rules.killBlind).toBeNull();
    expect(rules.requiresDeclaration).toBe(true);
  });
});
