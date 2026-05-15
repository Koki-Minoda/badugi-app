import { describe, expect, it } from "vitest";

import { buildCoverageShadowCandidates, buildDiversityAwareCorpus } from "../buildDiversityAwareCorpus.js";
import { expandDrawRoundCoverage } from "../expandDrawRoundCoverage.js";
import { expandPlayerCountCoverage } from "../expandPlayerCountCoverage.js";
import { expandStackDepthCoverage } from "../expandStackDepthCoverage.js";
import { generateCoverageTargetedReplayCorpus } from "../generateCoverageTargetedReplayCorpus.js";

describe("build diversity aware corpus", () => {
  it("deduplicates clean deterministic samples and preserves entropy metadata", () => {
    const corpus = generateCoverageTargetedReplayCorpus({ repeatsPerShape: 1 });
    const report = buildDiversityAwareCorpus({
      stackDepthReport: expandStackDepthCoverage({ samples: corpus.samples }),
      drawRoundReport: expandDrawRoundCoverage({ samples: corpus.samples }),
      playerCountReport: expandPlayerCountCoverage({ samples: corpus.samples }),
    });

    expect(report.sampleCount).toBe(corpus.sampleCount);
    expect(report.deterministicReplay).toBe(true);
    expect(report.invalidReplayCount).toBe(0);
    expect(report.illegal).toBe(0);
    expect(report.entropyMetadataPreserved).toBe(true);
    expect(buildCoverageShadowCandidates(report.samples)).toHaveLength(4);
    expect(report.datasetRowsChanged).toBe(false);
  });
});
