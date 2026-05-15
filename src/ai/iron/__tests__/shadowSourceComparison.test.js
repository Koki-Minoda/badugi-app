import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { analyzeShadowSourceComparison } from "../analyzeShadowSourceComparison.js";

describe("analyzeShadowSourceComparison", () => {
  it("summarizes selected and shadow source counts", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shadow-compare-"));
    const report = await analyzeShadowSourceComparison({
      auditRows: [
        {
          selectedSource: "verified-neighbor-v3-isolated",
          shadowSelectedSource: "verified-relaxed-match",
          sameAction: true,
          differentAction: false,
          sourceSpecificityDelta: 9.2,
        },
      ],
      outputPath: path.join(dir, "report.json"),
    });
    expect(report.exactOpportunities).toBe(1);
    expect(report.selectedSourceCounts["verified-neighbor-v3-isolated"]).toBe(1);
    expect(report.shadowSourceCounts["verified-relaxed-match"]).toBe(1);
  });
});
