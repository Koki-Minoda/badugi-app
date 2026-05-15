import { describe, expect, it } from "vitest";

import { buildReplayRevisitQueueSummary } from "../buildReplayRevisitQueue.js";

describe("buildReplayRevisitQueueSummary", () => {
  it("prioritizes deterministic high-EV repeated replay items", () => {
    const report = buildReplayRevisitQueueSummary({
      history: {
        entries: [
          { lessonId: "a", variantId: "S02", lessonTag: "missed-value", actionFamily: "CHECK->RAISE", evDelta: 30, replayRef: "r", replayUrl: "/r", replayDeterministic: true, helpfulState: "helpful" },
          { lessonId: "b", variantId: "D02", lessonTag: "second-pressure", evDelta: 50, replayDeterministic: false },
        ],
      },
      recap: { repeatedLeaks: [{ variantId: "S02", leakTag: "missed-value", actionFamily: "CHECK->RAISE" }] },
    });
    expect(report.queueCount).toBe(1);
    expect(report.items[0].lessonId).toBe("a");
    expect(report.items[0].priorityScore).toBe(55);
  });
});
