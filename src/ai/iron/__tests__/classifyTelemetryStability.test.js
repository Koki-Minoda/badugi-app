import { describe, expect, it } from "vitest";

import { classifyTelemetryStability } from "../classifyTelemetryStability.js";

function run({ datasetHitRate = 0, gap = 0, exactOpportunityRate = 0, sameActionRate = 1 } = {}) {
  return {
    rawStatus: "WARN",
    hardenedStatus: "PASS",
    datasetHitRate,
    ironProGap: { D02: gap, S01: gap, S02: gap },
    exactOpportunityRate,
    sameActionRate,
    proFallbackRate: 1,
    deterministicReplay: true,
  };
}

describe("classifyTelemetryStability", () => {
  it("classifies fewer than five completed runs as sparse", () => {
    const report = classifyTelemetryStability({ history: [run()] });
    expect(report.stability).toBe("SPARSE");
  });

  it("classifies five low-variance completed runs as stable", () => {
    const report = classifyTelemetryStability({
      history: Array.from({ length: 5 }, () => run({ datasetHitRate: 0, gap: 0 })),
    });
    expect(report.stability).toBe("STABLE");
  });

  it("classifies high variance as volatile", () => {
    const report = classifyTelemetryStability({
      history: [run({ gap: 0 }), run({ gap: 4 }), run({ gap: 0 }), run({ gap: 4 }), run({ gap: 0 })],
    });
    expect(report.stability).toBe("VOLATILE");
  });

  it("classifies repeated negative Iron-Pro runs as degrading", () => {
    const report = classifyTelemetryStability({
      history: [run({ gap: 1 }), run({ gap: 0 }), run({ gap: -1 }), run({ gap: -1 }), run({ gap: -1 })],
    });
    expect(report.stability).toBe("DEGRADING");
  });
});
