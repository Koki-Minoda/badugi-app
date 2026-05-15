import { describe, expect, it } from "vitest";
import { auditReplayCoachingUXSummary } from "../auditReplayCoachingUX.js";

describe("auditReplayCoachingUXSummary", () => {
  it("passes visible highlight, EV, timeline marker, and duplicate checks", () => {
    const report = auditReplayCoachingUXSummary({
      annotations: {
        annotations: [{ lessonId: "L1", actionIndex: 5, evDelta: 36.8 }],
      },
      markers: { result: "PASS" },
      localePreview: { mobileTruncationSafe: true },
    });
    expect(report.verdict).toBe("PASS");
  });
});

