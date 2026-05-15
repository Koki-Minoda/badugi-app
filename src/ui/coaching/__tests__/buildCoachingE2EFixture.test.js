import { describe, expect, it } from "vitest";
import { buildCoachingE2EFixtureSummary } from "../buildCoachingE2EFixture.js";

describe("buildCoachingE2EFixtureSummary", () => {
  it("builds a tournament-to-replay fixture from preview artifacts", () => {
    const fixture = buildCoachingE2EFixtureSummary({
      viewModel: {
        lessons: [
          {
            lessonId: "S02_DEEP_RAISECHECK_PC4",
            primaryTournamentLeak: true,
            replayRef: "r",
          },
        ],
      },
      replayLinks: {
        links: [
          {
            lessonId: "S02_DEEP_RAISECHECK_PC4",
            href: "/replay?variant=S02&seed=20261099&hand=6&actionIndex=5&lesson=S02_DEEP_RAISECHECK_PC4",
            deterministic: true,
            replayRefValid: true,
            replayRef: "r",
          },
        ],
      },
    });
    expect(fixture.coachingLesson.lessonId).toBe("S02_DEEP_RAISECHECK_PC4");
    expect(fixture.focusState.focusMode).toBe("coaching-lesson");
    expect(fixture.actionIndex).toBe(5);
    expect(fixture.fallbackCase.safe).toBe(true);
  });
});

