import { describe, expect, it } from "vitest";

import { replayShadowNeutrality } from "../replayShadowNeutrality.js";

describe("replayShadowNeutrality", () => {
  it("marks same-action rows as no gameplay change", async () => {
    const result = await replayShadowNeutrality({
      rows: [{ decisionId: "d1", selectedSource: "iso", shadowSource: "relaxed", sameAction: true, evDelta: 0 }],
      outputPath: "/tmp/step21-neutrality-replay.json",
    });
    expect(result.replayOutcomeChanged).toBe(0);
  });
});
