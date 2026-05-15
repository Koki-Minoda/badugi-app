import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { auditS02ExactMatchConditions } from "../auditS02ExactMatchConditions.js";

describe("auditS02ExactMatchConditions", () => {
  it("captures mismatch distributions", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "s02-audit-"));
    const arenaPath = path.join(dir, "arena.jsonl");
    await fs.writeFile(
      arenaPath,
      `${JSON.stringify({ variant: "S02", mismatchReason: "CALL_BAND_MISMATCH", handClass: "strongSDA5", playerCountReconciled: 3, positionBand: "IP", callBand: "tiny", pressureChain: "firstRaiseAfterCall", repeatedPressure: "single", exactOpportunity: false })}\n`,
      "utf8",
    );
    const report = await auditS02ExactMatchConditions({
      arenaNearMissPath: arenaPath,
      outputPath: path.join(dir, "report.json"),
    });
    expect(report.mismatchReasons.CALL_BAND_MISMATCH).toBe(1);
    expect(report.callBandArena.tiny).toBe(1);
  });
});
