import { describe, expect, it } from "vitest";
import { DEFAULT_AI_PROFILE, getProAiProfile } from "../proAiProfiles.js";

describe("getProAiProfile", () => {
  it("returns exact variant profile when available", () => {
    const profile = getProAiProfile("D03");
    expect(profile.id).toBe("ai-badugi-pro");
    expect(profile.aggression).toBeGreaterThan(DEFAULT_AI_PROFILE.aggression);
  });

  it("falls back to category profile", () => {
    const profile = getProAiProfile("B02");
    expect(profile.id).toBe("ai-board-pro");
    expect(profile.raiseSizeMultiplier).toBeGreaterThan(1);
  });

  it("returns default when variant unknown", () => {
    const profile = getProAiProfile("UNKNOWN");
    expect(profile).toEqual(DEFAULT_AI_PROFILE);
  });
});
