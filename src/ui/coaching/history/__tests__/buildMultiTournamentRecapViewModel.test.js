import { describe, expect, it } from "vitest";

import { buildMultiTournamentRecapViewModelSummary } from "../buildMultiTournamentRecapViewModel.js";

const entries = [
  { lessonId: "s1", variantId: "S02", lessonTag: "missed-value", actionFamily: "CHECK->RAISE", evDelta: 32, sessionId: "a", helpfulState: "helpful", replayViewed: true },
  { lessonId: "s2", variantId: "S02", lessonTag: "missed-value", actionFamily: "CHECK->RAISE", evDelta: 37, sessionId: "b", helpfulState: "helpful", replayViewed: true },
  { lessonId: "d1", variantId: "D02", lessonTag: "second-pressure", actionFamily: "CALL->RAISE", evDelta: 12, sessionId: "c", helpfulState: "unset" },
];

describe("buildMultiTournamentRecapViewModelSummary", () => {
  it("builds global and per-variant summaries", () => {
    const report = buildMultiTournamentRecapViewModelSummary({ entries });
    expect(report.global.totalLessons).toBe(3);
    expect(report.byVariant.S02.lessonCount).toBe(2);
    expect(report.byVariant.S02.topLeakTag).toBe("missed-value");
    expect(report.trendCopy.byVariant.S02.jp).toContain("S02");
  });
});
