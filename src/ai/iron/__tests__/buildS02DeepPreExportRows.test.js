import { describe, expect, it } from "vitest";

import { buildS02DeepPreExportRows } from "../buildS02DeepPreExportRows.js";

describe("buildS02DeepPreExportRows", () => {
  it("builds preview-only rows for the confident playerCount split", async () => {
    const result = await buildS02DeepPreExportRows({
      outputPath: "reports/ai-iron/test-preexport-s02-deep-raisecheck-step38.jsonl",
    });

    expect(result.rowCount).toBe(2);
    expect(result.rows.map((row) => row.playerCount).sort()).toEqual([3, 4]);
    expect(result.rows.every((row) => row.sourceType === "verified-forced-replay")).toBe(true);
    expect(result.rows.every((row) => row.observation.length === 96)).toBe(true);
    expect(result.datasetRowsChanged).toBe(false);
  }, 30000);
});
