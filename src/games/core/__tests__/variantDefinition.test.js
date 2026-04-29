import { describe, expect, it } from "vitest";
import { normalizeVariant, validateVariant } from "../variantDefinition.js";
import { getVariant } from "../variantRegistry.js";

describe("variantDefinition", () => {
  it("validates a known registered variant", () => {
    expect(validateVariant(getVariant("badugi"))).toBe(true);
  });

  it("normalizes optional collections", () => {
    const normalized = normalizeVariant({
      id: "test_variant",
      name: "Test Variant",
      base: "holdem",
      players: { min: 2, max: 2 },
      deck: { type: "standard52" },
      holeCards: { count: 2 },
      boards: { count: 1, cardsPerBoard: 5 },
      betting: { structure: "none", hasPreflop: false },
      showdown: { evaluator: "test", splitMode: "single" },
    });

    expect(normalized.boards.streets).toEqual([]);
    expect(normalized.betting.streets).toEqual([]);
    expect(normalized.forcedBets.type).toBe("none");
    expect(normalized.modifiers).toEqual([]);
  });

  it("detects invalid variants", () => {
    expect(() =>
      validateVariant({
        id: "invalid_omaha",
        name: "Invalid Omaha",
        base: "omaha",
        players: { min: 2, max: 6 },
        deck: { type: "standard52" },
        holeCards: { count: 4 },
        boards: { count: 1, cardsPerBoard: 5, streets: ["flop"] },
        betting: { structure: "potLimit", streets: ["flop"], hasPreflop: true },
        forcedBets: { type: "blinds" },
        showdown: { evaluator: "omahaHigh", splitMode: "single" },
        modifiers: [],
      }),
    ).toThrow(/Omaha/);
  });
});
