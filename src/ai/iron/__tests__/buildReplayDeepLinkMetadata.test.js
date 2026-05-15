import { describe, expect, it } from "vitest";

import { buildReplayDeepLinkMetadataSummary } from "../buildReplayDeepLinkMetadata.js";

describe("buildReplayDeepLinkMetadata", () => {
  it("creates deterministic replay link metadata", () => {
    const report = buildReplayDeepLinkMetadataSummary({
      handoff: {
        candidates: [
          {
            candidateId: "S02_DEEP_RAISECHECK_PC3",
            variantId: "S02",
            spot: "deep RAISE-vs-CHECK",
            bucket: "bucket",
            playerCount: 3,
            lessonTag: "missed-value",
            replayReference: { runId: "step46-runA", seed: 1, handId: 2, actionIndex: 3, replayDeterministic: true },
          },
        ],
      },
    });
    expect(report.linkCount).toBe(1);
    expect(report.links[0].variant).toBe("S02");
    expect(report.links[0].replayDeterministic).toBe(true);
    expect(report.routingChanged).toBe(false);
  });
});
