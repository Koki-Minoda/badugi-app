import { describe, expect, it } from "vitest";
import { assertPayoutInvariant } from "../assertPayoutInvariant.js";

describe("payout invariant", () => {
  it("requires safe payouts when expected", () => {
    expect(assertPayoutInvariant({ payoutsExpected: true, payoutSafe: false })[0].type).toBe("PAYOUT_FAILURE");
  });
});

