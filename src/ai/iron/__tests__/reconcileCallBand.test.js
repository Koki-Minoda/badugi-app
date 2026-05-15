import { describe, expect, it } from "vitest";

import { replayCompatibleCallBand } from "../reconcileCallBand.js";

describe("replayCompatibleCallBand", () => {
  it("promotes tiny fixed-limit calls to small in replay-compatible mode", () => {
    expect(
      replayCompatibleCallBand({
        toCall: 20,
        pot: 80,
        stack: 200,
        limitUnit: 20,
        street: 1,
        variantId: "S02",
      }),
    ).toBe("small");
  });

  it("keeps large calls unchanged", () => {
    expect(
      replayCompatibleCallBand({
        toCall: 60,
        pot: 80,
        stack: 200,
        limitUnit: 20,
        street: 1,
        variantId: "S02",
      }),
    ).toBe("medium");
  });
});
