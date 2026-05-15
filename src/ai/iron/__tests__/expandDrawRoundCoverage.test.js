import { describe, expect, it } from "vitest";

import { expandDrawRoundCoverage } from "../expandDrawRoundCoverage.js";
import { generateCoverageTargetedReplayCorpus } from "../generateCoverageTargetedReplayCorpus.js";

describe("expand draw round coverage", () => {
  it("covers all draw-round classes including showdown", () => {
    const corpus = generateCoverageTargetedReplayCorpus({ repeatsPerShape: 1 });
    const report = expandDrawRoundCoverage({ samples: corpus.samples });

    expect(report.unique).toEqual(["draw-0", "draw-1", "draw-2", "draw-3", "showdown"]);
    expect(report.achievedCoverage).toBe(1);
    expect(report.passedTarget).toBe(true);
    expect(report.freeze).toBe(0);
  });
});
