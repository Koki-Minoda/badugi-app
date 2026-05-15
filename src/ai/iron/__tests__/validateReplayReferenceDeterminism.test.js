import { describe, expect, it } from "vitest";

import { validateReplayReferenceDeterminismSummary } from "../validateReplayReferenceDeterminism.js";

describe("validateReplayReferenceDeterminism", () => {
  it("passes when replay refs and corpus determinism are clean", () => {
    const report = validateReplayReferenceDeterminismSummary({
      replayLinks: {
        links: [{ lessonId: "lesson", replayRef: "run:seed:hand:action", deterministic: true, replayRefValid: true }],
      },
      determinism: { deterministic: true, mismatchCount: 0, invalidReplayCount: 0 },
    });
    expect(report.deterministic).toBe(true);
    expect(report.mismatchCount).toBe(0);
  });
});
