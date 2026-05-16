import { describe, expect, it } from "vitest";
import { assertMenuReturnInvariant } from "../assertMenuReturnInvariant.js";

describe("menu return invariant", () => {
  it("flags tournament menu return failure", () => {
    expect(assertMenuReturnInvariant({ menuReturnExpected: true, menuReturnSafe: false })[0].type).toBe(
      "TOURNAMENT_MENU_RETURN_FAILED",
    );
  });
});

