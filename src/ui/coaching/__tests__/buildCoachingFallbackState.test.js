import { describe, expect, it } from "vitest";

import { buildCoachingFallbackState } from "../buildCoachingFallbackState.js";

describe("buildCoachingFallbackState", () => {
  it("returns a safe unavailable state for missing or mismatched replay metadata", () => {
    const state = buildCoachingFallbackState({
      replayAvailable: false,
      replayDeterministic: false,
      metadata: {},
      variantId: "D01",
    });
    expect(state.status).toBe("preview-unavailable");
    expect(state.safe).toBe(true);
    expect(state.reasons).toContain("replay-unavailable");
    expect(state.reasons).toContain("unsupported-variant");
  });
});
