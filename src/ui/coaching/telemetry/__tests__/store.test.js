import { describe, expect, it } from "vitest";
import { createCoachingTelemetryStore } from "../store.js";

describe("createCoachingTelemetryStore", () => {
  it("records events in deterministic sequence order", () => {
    const store = createCoachingTelemetryStore({
      sessionId: "preview-store",
      clock: () => "2026-05-15T03:00:00.000Z",
    });
    store.record({ type: "LESSON_SHOWN", lessonId: "a" });
    store.record({ type: "REPLAY_OPENED", lessonId: "a" });
    store.record({ type: "REPLAY_COMPLETED", lessonId: "a" });

    expect(store.getEvents().map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(store.exportJson()).toContain("previewOnly");
  });

  it("can clear the local preview queue", () => {
    const store = createCoachingTelemetryStore({ clock: () => "2026-05-15T03:00:00.000Z" });
    store.record({ type: "LESSON_SHOWN", lessonId: "a" });
    store.clear();
    expect(store.getEvents()).toHaveLength(0);
  });
});
