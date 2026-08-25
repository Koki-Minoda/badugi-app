import { describe, expect, it } from "vitest";
import { assertCashOutInvariant } from "../assertCashOutInvariant.js";

describe("cash out invariant", () => {
  it("requires menu return after cash out", () => {
    expect(assertCashOutInvariant({ cashOutAttempted: true, cashOutReturnedToMenu: false })[0].type).toBe(
      "CASH_OUT_MENU_RETURN_FAILED",
    );
  });

  it("passes safe cash out and re-entry", () => {
    expect(
      assertCashOutInvariant({
        cashOutAttempted: true,
        cashOutReturnedToMenu: true,
        reenterAttempted: true,
        reenterClean: true,
      }),
    ).toEqual([]);
  });
});

