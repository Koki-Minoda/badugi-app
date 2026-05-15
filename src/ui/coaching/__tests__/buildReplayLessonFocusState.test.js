import { describe, expect, it } from "vitest";
import {
  buildReplayLessonFocusPreviewSummary,
  buildReplayLessonFocusState,
} from "../buildReplayLessonFocusState.js";

describe("buildReplayLessonFocusState", () => {
  it("builds a coaching lesson focus target from a replay link", () => {
    const state = buildReplayLessonFocusState({
      href: "/replay?variant=S02&seed=20260609&hand=1&actionIndex=5&lesson=S02_DEEP_RAISECHECK_PC3",
      deterministic: true,
      replayRefValid: true,
      knownLessonIds: ["S02_DEEP_RAISECHECK_PC3"],
    });
    expect(state).toMatchObject({
      status: "ready",
      focusMode: "coaching-lesson",
      actionIndex: 5,
      lessonId: "S02_DEEP_RAISECHECK_PC3",
      target: {
        handId: "1",
        actionSeqStart: 5,
      },
    });
  });

  it("falls back safely when replay metadata is not usable", () => {
    const state = buildReplayLessonFocusState({
      href: "/replay?variant=S02&seed=20260609&hand=1&actionIndex=5&lesson=UNKNOWN",
      deterministic: false,
      replayRefValid: false,
      knownLessonIds: ["S02_DEEP_RAISECHECK_PC3"],
    });
    expect(state.status).toBe("preview-unavailable");
    expect(state.safe).toBe(true);
    expect(state.reasons).toEqual(
      expect.arrayContaining(["replay-not-deterministic", "replay-ref-invalid", "lesson-unknown"]),
    );
  });

  it("summarizes ready and fallback focus states", () => {
    const summary = buildReplayLessonFocusPreviewSummary({
      replayLinks: {
        links: [
          {
            href: "/replay?variant=S02&seed=1&hand=2&actionIndex=3&lesson=L1",
            deterministic: true,
            replayRefValid: true,
          },
        ],
      },
      viewModel: { lessons: [{ lessonId: "L1" }] },
    });
    expect(summary.readyCount).toBe(1);
    expect(summary.fallbackCount).toBe(0);
  });
});

