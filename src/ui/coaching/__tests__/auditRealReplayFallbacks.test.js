import { describe, expect, it } from "vitest";
import { auditRealReplayFallbacksSummary } from "../auditRealReplayFallbacks.js";

describe("auditRealReplayFallbacksSummary", () => {
  it("keeps every real replay fallback safe", () => {
    const report = auditRealReplayFallbacksSummary({
      fixtureReport: { fixtures: [{ lessonId: "S02_DEEP_RAISECHECK_PC3" }] },
    });

    expect(report.allSafe).toBe(true);
    expect(report.cases).toHaveLength(6);
    expect(report.cases.every((entry) => entry.safe && !entry.crash)).toBe(true);
  });
});
