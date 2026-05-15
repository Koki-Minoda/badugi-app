import { describe, expect, it } from "vitest";
import {
  COACHING_TELEMETRY_EVENT_TYPES,
  createCoachingTelemetryEvent,
  validateCoachingTelemetryEvent,
} from "../schema.js";

describe("coaching telemetry schema", () => {
  it("creates preview-only events without PII or upload", () => {
    const event = createCoachingTelemetryEvent({
      type: "LESSON_SHOWN",
      lesson: {
        lessonId: "S02_DEEP_RAISECHECK_PC3",
        variantId: "S02",
        actionIndex: 5,
        estimatedEVGain: 32.2,
        severity: "medium",
        replayDeterministic: true,
      },
      sessionId: "preview-1",
      deviceClass: "mobile",
    });

    expect(COACHING_TELEMETRY_EVENT_TYPES).toContain(event.type);
    expect(event.previewOnly).toBe(true);
    expect(event.upload).toBe(false);
    expect(event.pii).toBe(false);
    expect(validateCoachingTelemetryEvent(event).valid).toBe(true);
  });

  it("rejects hidden PII fields", () => {
    const event = createCoachingTelemetryEvent({
      type: "LESSON_OPENED",
      lessonId: "lesson",
      sessionId: "preview-1",
    });
    expect(validateCoachingTelemetryEvent({ ...event, userId: "user-1" }).errors).toContain(
      "pii-field-present",
    );
  });
});
