import { describe, expect, it } from "vitest";

import { runFocusedS02Counterfactual } from "../runFocusedS02Counterfactual.js";
import { s02Sample } from "./s02CounterfactualFixtures.js";

describe("runFocusedS02Counterfactual", () => {
  it("summarizes focused replay results for S02 lowerMediumSDA5 bet-pressure", async () => {
    const replayResults = Array.from({ length: 32 }, (_value, index) => ({
      sample: s02Sample({ position: index % 2 ? "button" : "cutoff" }),
      seed: index,
      handId: index,
      step: 1,
      standardAction: "CALL",
      proAction: "FOLD",
      standardEv: 25,
      proEv: 0,
      delta: 25,
      ok: true,
      legality: { invalidReplay: false, legalActionMismatch: false, repairRequired: false },
      fallbackAction: "FOLD",
    }));

    const report = await runFocusedS02Counterfactual({ replayResults, runReplay: false });

    expect(report.sampleCount).toBe(32);
    expect(report.meanDelta).toBe(25);
    expect(report.signFlipRate).toBe(0);
    expect(report.invalidReplayCount).toBe(0);
    expect(report.verdict).toBe("EXPORTABLE_CANDIDATE");
  });
});
