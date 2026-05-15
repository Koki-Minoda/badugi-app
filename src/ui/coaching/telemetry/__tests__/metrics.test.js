import { describe, expect, it } from "vitest";
import { computeCoachingEngagementMetrics } from "../metrics.js";

describe("computeCoachingEngagementMetrics", () => {
  it("computes replay and helpful engagement rates", () => {
    const events = [
      { type: "LESSON_SHOWN", lessonId: "a", sequence: 1, timestamp: "2026-05-15T03:00:00.000Z" },
      { type: "LESSON_OPENED", lessonId: "a", sequence: 2, timestamp: "2026-05-15T03:00:01.000Z" },
      { type: "REPLAY_OPENED", lessonId: "a", sequence: 3, timestamp: "2026-05-15T03:00:05.000Z" },
      { type: "LESSON_HELPFUL", lessonId: "a", sequence: 4, timestamp: "2026-05-15T03:00:06.000Z" },
      { type: "REPLAY_COMPLETED", lessonId: "a", sequence: 5, timestamp: "2026-05-15T03:00:35.000Z" },
    ];

    const metrics = computeCoachingEngagementMetrics(events);
    expect(metrics.lessonOpenRate).toBe(1);
    expect(metrics.replayOpenRate).toBe(1);
    expect(metrics.replayCompletionRate).toBe(1);
    expect(metrics.helpfulRate).toBe(1);
    expect(metrics.avgReplayViewDuration).toBe(30);
  });
});
