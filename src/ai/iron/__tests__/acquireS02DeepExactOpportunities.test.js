import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { acquireS02DeepExactOpportunities } from "../acquireS02DeepExactOpportunities.js";

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "step41-opportunities-"));
}

describe("acquire S02 deep exact opportunities", () => {
  it("scans replay samples for legal deep RAISE-vs-CHECK playerCount branches", async () => {
    const dir = await makeTempDir();
    const sample = {
      variantId: "S02",
      seed: 1,
      handId: 2,
      step: 3,
      actorSeat: 0,
      playerCount: 3,
      standardAction: { type: "RAISE" },
      proAction: { type: "CHECK" },
      legalActions: [{ type: "CHECK" }, { type: "RAISE" }],
      snapshot: { players: [{ stack: 500 }] },
    };
    await fs.writeFile(path.join(dir, "iron-step37-s02-20260910.jsonl"), `${JSON.stringify(sample)}\n`, "utf8");
    const outputPath = path.join(dir, "out.jsonl");

    const report = await acquireS02DeepExactOpportunities({ sampleDir: dir, outputPath, minDecisionScan: 1 });
    const lines = (await fs.readFile(outputPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));

    expect(report.exactOpportunityCount).toBe(1);
    expect(report.exactLegalCount).toBe(1);
    expect(report.scanTargetMet).toBe(true);
    expect(lines[0]).toMatchObject({ type: "summary", exactOpportunityCount: 1 });
    expect(lines[1]).toMatchObject({ type: "opportunity", playerCount: 3, actionPair: "RAISE-vs-CHECK" });
  });
});
