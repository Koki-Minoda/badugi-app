import { describe, expect, it } from "vitest";
import { assertFeedbackInvariant } from "../assertFeedbackInvariant.js";

describe("feedback invariant", () => {
  it("flags tournament feedback failures", () => {
    expect(assertFeedbackInvariant({ feedbackExpected: true, feedbackSafe: false })[0].type).toBe(
      "TOURNAMENT_FEEDBACK_FAILURE",
    );
  });
});

