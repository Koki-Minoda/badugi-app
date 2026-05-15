import { describe, expect, it } from "vitest";

import { simulateSourcePriorityOverride } from "../simulateSourcePriorityOverride.js";

describe("simulateSourcePriorityOverride", () => {
  it("keeps gameplay unchanged for same-action override", async () => {
    const result = await simulateSourcePriorityOverride({
      rows: [{ decisionId: "d1", selectedSource: "iso", shadowSource: "relaxed", sameAction: true }],
      outputPath: "/tmp/step21-override.json",
    });
    expect(result.overrideWouldChangeGameplay).toBe(0);
  });
});
