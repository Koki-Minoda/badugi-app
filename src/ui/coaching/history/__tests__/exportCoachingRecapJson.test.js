import { describe, expect, it } from "vitest";

import { exportCoachingRecapJsonSummary } from "../exportCoachingRecapJson.js";

describe("exportCoachingRecapJsonSummary", () => {
  it("exports local preview recap without PII or network telemetry", () => {
    const report = exportCoachingRecapJsonSummary({
      recap: { global: { totalLessons: 2 }, byVariant: { S02: { lessonCount: 2 } } },
      repeatedLeaks: { byVariant: { S02: [] } },
      telemetry: { global: { lessonsShown: 2 } },
    });
    expect(report.previewOnly).toBe(true);
    expect(report.piiIncluded).toBe(false);
    expect(report.networkTelemetry).toBe(false);
    expect(report.perVariantSummary.S02.lessonCount).toBe(2);
  });
});
