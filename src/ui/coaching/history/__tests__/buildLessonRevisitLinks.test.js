import { describe, expect, it } from "vitest";

import { buildLessonRevisitLinksSummary } from "../buildLessonRevisitLinks.js";

describe("buildLessonRevisitLinksSummary", () => {
  it("marks deterministic replay links as valid and missing links as safe fallback", () => {
    const report = buildLessonRevisitLinksSummary({
      entries: [
        { lessonId: "a", replayRef: "r", replayUrl: "/r", replayDeterministic: true },
        { lessonId: "b", replayDeterministic: false },
      ],
    });
    expect(report.validCount).toBe(1);
    expect(report.links.find((link) => link.lessonId === "b").fallback.safe).toBe(true);
  });
});
