import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { analyzeS02ExactOpportunityTrace } from "../analyzeS02ExactOpportunityTrace.js";

const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((entry) => fs.rm(entry, { recursive: true, force: true })));
});

describe("S02 exact opportunity trace", () => {
  it("writes a trace summary even when exact opportunities are absent", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "s02-exact-trace-"));
    tempDirs.push(tempDir);
    const opportunityPath = path.join(tempDir, "summary.json");
    const nearMissPath = path.join(tempDir, "near-miss.jsonl");
    const outputPath = path.join(tempDir, "trace.json");
    await fs.writeFile(
      opportunityPath,
      JSON.stringify({
        targetBucket: "S02_RELAXED_V3",
        exactOpportunities: 0,
        finalDatasetHits: 0,
        nearMisses: 1,
        playerCountTransitions: { "collapsed-6-to-2": 1 },
        activePlayersAtHandStart: { 6: 1 },
        activePlayersAtDecision: { 2: 1 },
        effectivePlayerCount: { 2: 1 },
        mismatchReasons: { PLAYERCOUNT_MISMATCH: 1 },
      }),
      "utf8",
    );
    await fs.writeFile(
      nearMissPath,
      `${JSON.stringify({
        decisionId: "demo",
        activePlayersAtHandStart: 6,
        activePlayersAtDecision: 2,
        effectivePlayerCount: 2,
        handClass: "strongSDA5",
        position: "button",
        callBand: "small",
        pressureChain: "firstRaiseAfterCall",
        exactOpportunity: false,
        selectedAction: { type: "CALL" },
        datasetAction: { type: "RAISE" },
        mismatchReason: "PLAYERCOUNT_MISMATCH",
      })}\n`,
      "utf8",
    );

    const { report } = await analyzeS02ExactOpportunityTrace({
      opportunityPath,
      nearMissPath,
      outputPath,
    });

    expect(report.exactOpportunities).toBe(0);
    expect(report.datasetHits).toBe(0);
    expect(report.sampleTrace).toHaveLength(1);
    expect(report.sampleTrace[0].mismatchReason).toBe("PLAYERCOUNT_MISMATCH");
  });
});
