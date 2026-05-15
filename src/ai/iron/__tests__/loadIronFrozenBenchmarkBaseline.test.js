import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadIronFrozenBenchmarkBaseline } from "../loadIronFrozenBenchmarkBaseline.js";

const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("loadIronFrozenBenchmarkBaseline", () => {
  it("loads frozen baseline governance artifacts", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "iron-frozen-baseline-"));
    tempDirs.push(dir);

    const baselinePath = path.join(dir, "baseline.json");
    const freezeDecisionPath = path.join(dir, "freeze.json");
    const shadowTelemetryPolicyPath = path.join(dir, "shadow.json");
    const guardrailsPath = path.join(dir, "guardrails.json");
    const arenaBaselinePath = path.join(dir, "arena.json");

    await fs.writeFile(
      baselinePath,
      JSON.stringify(
        {
          dataset: "data/ai/action-value/iron-step15-action-value.jsonl",
          variants: ["D02", "S01", "S02"],
          priorityOrdering: [{ sourceType: "stable-bucket", priority: 0 }],
          sourceTypeCounts: { "stable-bucket": 606 },
        },
        null,
        2,
      ),
      "utf8",
    );
    await fs.writeFile(freezeDecisionPath, JSON.stringify({ sameActionRate: 1, freezeRecommended: true }, null, 2), "utf8");
    await fs.writeFile(
      shadowTelemetryPolicyPath,
      JSON.stringify({ priorityFrozen: true, shadowTelemetryEnabled: true }, null, 2),
      "utf8",
    );
    await fs.writeFile(guardrailsPath, JSON.stringify({ requireDeterministicReplay: true }, null, 2), "utf8");
    await fs.writeFile(
      arenaBaselinePath,
      JSON.stringify({ arenaId: "iron-step15", results: [{ variant: "D02", ironProGap: 1, datasetHitRate: 0.01 }] }, null, 2),
      "utf8",
    );

    const loaded = await loadIronFrozenBenchmarkBaseline({
      baselinePath,
      freezeDecisionPath,
      shadowTelemetryPolicyPath,
      guardrailsPath,
      arenaBaselinePath,
    });

    expect(loaded.dataset).toContain("iron-step15");
    expect(loaded.priorityFrozen).toBe(true);
    expect(loaded.shadowTelemetryEnabled).toBe(true);
    expect(loaded.baselineMetrics.byVariant.D02.ironProGap).toBe(1);
  });
});
