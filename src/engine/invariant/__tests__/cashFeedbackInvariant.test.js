import { describe, expect, it } from "vitest";
import { assertCashFeedbackInvariant } from "../assertCashFeedbackInvariant.js";

describe("cash feedback invariant", () => {
  it("treats explicit disabled feedback as safe", () => {
    expect(assertCashFeedbackInvariant({ feedbackEnabled: false })).toEqual([]);
  });

  it("flags unsafe enabled feedback", () => {
    expect(assertCashFeedbackInvariant({ feedbackEnabled: true, feedbackSafe: false })[0].type).toBe(
      "CASH_FEEDBACK_FAILURE",
    );
  });
});

