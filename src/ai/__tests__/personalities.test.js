import { describe, expect, it } from "vitest";
import {
  AI_PERSONALITIES,
  getPersonalityById,
  getPersonalityParameters,
  hasRequiredPersonalityParameters,
  normalizePersonalityId,
} from "../../config/ai/personalities.js";

describe("AI personalities", () => {
  it("defines the baseline tournament personality set", () => {
    const ids = AI_PERSONALITIES.map((personality) => personality.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "nit",
        "tag",
        "lag",
        "maniac",
        "calling-station",
        "balanced",
      ]),
    );
  });

  it("keeps all personalities on the required parameter schema", () => {
    const requiredParameters = getPersonalityParameters();
    expect(requiredParameters).toEqual([
      "aggression",
      "looseness",
      "bluff",
      "callDown",
      "drawGreed",
      "tiltResistance",
    ]);
    AI_PERSONALITIES.forEach((personality) => {
      expect(hasRequiredPersonalityParameters(personality)).toBe(true);
      requiredParameters.forEach((key) => {
        expect(personality[key]).toBeGreaterThanOrEqual(0);
        expect(personality[key]).toBeLessThanOrEqual(1);
      });
    });
  });

  it("falls back to balanced for unknown personality ids", () => {
    expect(getPersonalityById("unknown").id).toBe("balanced");
    expect(normalizePersonalityId("unknown")).toBe("balanced");
  });
});
