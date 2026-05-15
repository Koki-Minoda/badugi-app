import { describe, expect, it } from "vitest";

import { runIronOfflineArena } from "../runIronOfflineArena.js";

describe("iron offline arena", () => {
  it("runs a dry-run benchmark without promotion or routing mutation", async () => {
    const result = await runIronOfflineArena({
      datasetPath: "data/ai/action-value/iron-step7-action-value.jsonl",
      variants: ["D02"],
      hands: 1,
      seeds: [20260524],
      outputPath: "reports/ai-iron/iron-step8-offline-arena-test.json",
    });
    expect(result.candidate).toBe("iron-candidate-dryrun");
    expect(result.promoted).toBe(false);
    expect(result.eligibleForPromotion).toBe(false);
    expect(result.routingChanged).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].variant).toBe("D02");
  }, 15000);
});
