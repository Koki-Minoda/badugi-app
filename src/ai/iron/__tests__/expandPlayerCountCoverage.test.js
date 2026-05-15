import { describe, expect, it } from "vitest";

import { expandPlayerCountCoverage } from "../expandPlayerCountCoverage.js";
import { generateCoverageTargetedReplayCorpus } from "../generateCoverageTargetedReplayCorpus.js";

describe("expand player count coverage", () => {
  it("covers HU, 3way, and 4way+ target classes", () => {
    const corpus = generateCoverageTargetedReplayCorpus({ repeatsPerShape: 1 });
    const report = expandPlayerCountCoverage({ samples: corpus.samples });

    expect(report.unique).toEqual(["3way", "4way+", "HU"]);
    expect(report.achievedCoverage).toBe(1);
    expect(report.passedTarget).toBe(true);
    expect(report.deterministicReplay).toBe(true);
  });
});
