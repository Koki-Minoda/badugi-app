import { describe, expect, it } from "vitest";
import { parseReplayLessonLink } from "../parseReplayLessonLink.js";

describe("parseReplayLessonLink", () => {
  it("parses query-style replay lesson links", () => {
    expect(
      parseReplayLessonLink(
        "/replay?variant=S02&seed=20260609&hand=1&actionIndex=5&lesson=S02_DEEP_RAISECHECK_PC3",
      ),
    ).toMatchObject({
      variantId: "S02",
      seed: "20260609",
      handId: "1",
      actionIndex: 5,
      lessonId: "S02_DEEP_RAISECHECK_PC3",
      valid: true,
      errors: [],
    });
  });

  it("parses path-style preview links with decision fallback", () => {
    expect(parseReplayLessonLink("/replay/S02/20260609/1?decision=5&lesson=L1")).toMatchObject({
      variantId: "S02",
      seed: "20260609",
      handId: "1",
      actionIndex: 5,
      lessonId: "L1",
      valid: true,
    });
  });

  it("returns safe parse errors for incomplete links", () => {
    const parsed = parseReplayLessonLink("/replay?variant=S02");
    expect(parsed.valid).toBe(false);
    expect(parsed.errors).toEqual(
      expect.arrayContaining(["missing-seed", "missing-hand", "missing-action-index", "missing-lesson"]),
    );
  });
});

