import { describe, expect, it } from "vitest";

import { replayCompatiblePressureChain } from "../reconcilePressureChain.js";

describe("replayCompatiblePressureChain", () => {
  it("treats firstRaiseAfterCall as repeated pressure family", () => {
    const result = replayCompatiblePressureChain({
      pressureChain: "firstRaiseAfterCall",
      repeatedPressure: "single",
    });
    expect(result.pressureChain).toBe("firstRaiseAfterCall");
    expect(result.repeatedPressure).toBe("repeated");
    expect(result.reconciled).toBe(true);
  });

  it("passes repeated pressure through unchanged", () => {
    const result = replayCompatiblePressureChain({
      pressureChain: "repeatedPressure",
      repeatedPressure: "repeated",
    });
    expect(result.repeatedPressure).toBe("repeated");
    expect(result.reconciled).toBe(false);
  });
});
