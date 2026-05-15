import { describe, expect, it } from "vitest";
import {
  buildReplayAnnotationFallback,
  buildReplayAnnotationFallbackSummary,
} from "../buildReplayAnnotationFallback.js";

describe("buildReplayAnnotationFallback", () => {
  it("returns safe fallback for invalid annotation conditions", () => {
    const state = buildReplayAnnotationFallback({ lesson: { lessonId: "L1", variantId: "D01" } });
    expect(state.safe).toBe(true);
    expect(state.crash).toBe(false);
    expect(state.reasons).toContain("unsupported-variant");
  });

  it("summarizes Step50 fallback cases as safe", () => {
    const report = buildReplayAnnotationFallbackSummary();
    expect(report.allSafe).toBe(true);
    expect(report.cases.every((entry) => entry.crash === false)).toBe(true);
  });
});

