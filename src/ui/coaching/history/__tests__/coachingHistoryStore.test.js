import { describe, expect, it } from "vitest";

import { createCoachingHistoryStore, normalizeCoachingHistoryEntry } from "../coachingHistoryStore.js";

describe("coachingHistoryStore", () => {
  it("stores preview-only lessons in deterministic order", () => {
    const store = createCoachingHistoryStore();
    store.addLesson({ lessonId: "b", timestamp: "2026-05-15T04:01:00.000Z", estimatedEVGain: 10 });
    store.addLesson({ lessonId: "a", timestamp: "2026-05-15T04:00:00.000Z", estimatedEVGain: 20 });
    store.markHelpful("a");
    store.markReplayViewed("a");
    const entries = store.getEntries();
    expect(entries.map((entry) => entry.lessonId)).toEqual(["a", "b"]);
    expect(entries[0].helpfulState).toBe("helpful");
    expect(entries[0].replayViewed).toBe(true);
    expect(entries.every((entry) => entry.previewOnly && entry.upload === false && entry.pii === false)).toBe(true);
  });

  it("normalizes invalid helpful state and can clear", () => {
    const store = createCoachingHistoryStore({ initialEntries: [normalizeCoachingHistoryEntry({ lessonId: "x", helpfulState: "bad" })] });
    expect(store.getEntries()[0].helpfulState).toBe("unset");
    store.clear();
    expect(store.getEntries()).toHaveLength(0);
  });
});
