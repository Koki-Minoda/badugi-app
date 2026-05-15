import { describe, expect, it } from "vitest";
import { validateStep52ReplayTelemetryDeterminismSummary } from "../validateStep52ReplayTelemetryDeterminism.js";

describe("validateStep52ReplayTelemetryDeterminismSummary", () => {
  it("passes when replay fixtures and telemetry ordering are deterministic", () => {
    const report = validateStep52ReplayTelemetryDeterminismSummary({
      fixtureReport: { allDeterministic: true },
      engagementReport: {
        deterministicOrdering: true,
        backendUpload: false,
        networkDependency: false,
        events: [{ type: "LESSON_SHOWN" }],
      },
    });

    expect(report.status).toBe("PASS");
    expect(report.mismatchCount).toBe(0);
    expect(report.invalidReplayCount).toBe(0);
  });
});
