import { describe, expect, it } from "vitest";

import { expandStackDepthCoverage } from "../expandStackDepthCoverage.js";
import { generateCoverageTargetedReplayCorpus } from "../generateCoverageTargetedReplayCorpus.js";

describe("expand stack depth coverage", () => {
  it("covers shallow, medium, deep, and ultra-deep target bands", () => {
    const corpus = generateCoverageTargetedReplayCorpus({ repeatsPerShape: 1 });
    const report = expandStackDepthCoverage({ samples: corpus.samples });

    expect(report.achievedCoverage).toBe(1);
    expect(report.passedTarget).toBe(true);
    expect(report.invalidReplayCount).toBe(0);
    expect(report.illegal).toBe(0);
  });
});
