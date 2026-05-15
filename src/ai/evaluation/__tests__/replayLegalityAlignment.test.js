import { describe, expect, it } from "vitest";

import { runAiEvaluationBatch } from "../runAiEvaluationBatch.js";
import { replayDivergenceAction } from "../replayDivergenceAction.js";

describe("replay legality alignment", () => {
  it("blocks stale raise actions before replay when restored legality no longer allows them", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "D02",
      seed: 20260512,
      hands: 12,
      playerCount: 6,
    });
    const sample = result.analysis?.divergenceReplaySamples?.find((entry) =>
      !(entry.legalActions ?? []).some((action) => String(action?.type ?? action).toUpperCase() === "RAISE"),
    );
    expect(sample).toBeTruthy();
    const replay = await replayDivergenceAction({
      sample: {
        ...sample,
        legalActions: [...(sample.legalActions ?? []), { type: "RAISE" }],
      },
      action: { type: "RAISE" },
      rolloutPolicy: "pro",
      rolloutSeeds: [1],
    });
    expect(replay.ok).toBe(false);
    expect(replay.invalidReason).toBe("LEGAL_ACTION_MISMATCH");
    expect(replay.legalityValidated).toBe(false);
  });
});
