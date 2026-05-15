import { describe, expect, it } from "vitest";

import { buildReplayLinksSummary, createReplayDeepLink } from "../createReplayDeepLink.js";

describe("createReplayDeepLink", () => {
  it("creates stable replay query URLs and validates references", () => {
    const link = createReplayDeepLink({
      candidateId: "S02_DEEP_RAISECHECK_PC3",
      variant: "S02",
      seed: 20260609,
      handId: 1,
      actionIndex: 5,
      replayDeterministic: true,
      replayRef: "step46-runA:20260609:1:5",
    });
    expect(link.href).toBe("/replay?variant=S02&seed=20260609&hand=1&actionIndex=5&lesson=S02_DEEP_RAISECHECK_PC3");
    expect(link.replayRefValid).toBe(true);
    const report = buildReplayLinksSummary({ replayMetadata: { links: [{ candidateId: "x", variant: "S02", seed: 1, handId: 2, actionIndex: 3, replayDeterministic: true }] } });
    expect(report.deterministic).toBe(true);
  });
});
