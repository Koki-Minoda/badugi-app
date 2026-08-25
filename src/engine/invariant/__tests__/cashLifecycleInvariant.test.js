import { describe, expect, it } from "vitest";
import { assertCashLifecycleInvariant } from "../assertCashLifecycleInvariant.js";

describe("cash lifecycle invariant", () => {
  it("passes completed cash lifecycle rows", () => {
    expect(assertCashLifecycleInvariant({ mode: "cash", handsCompleted: 5, nextHandStarted: true })).toEqual([]);
  });

  it("flags missing hand completion", () => {
    expect(assertCashLifecycleInvariant({ mode: "cash", handsCompleted: 0 })[0].type).toBe("CASH_HAND_NOT_COMPLETED");
  });
});

