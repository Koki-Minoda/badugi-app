import { describe, expect, it } from "vitest";
import { assertChampionInvariant } from "../assertChampionInvariant.js";

describe("champion invariant", () => {
  it("requires safe champion lifecycle when expected", () => {
    expect(assertChampionInvariant({ championExpected: true, championSafe: false })[0].type).toBe(
      "CHAMPION_LIFECYCLE_FAILED",
    );
  });
});

