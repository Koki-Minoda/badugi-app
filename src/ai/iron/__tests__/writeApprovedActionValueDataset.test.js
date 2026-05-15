import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { buildS02DeepPreExportRows } from "../buildS02DeepPreExportRows.js";
import { writeApprovedActionValueDataset } from "../writeApprovedActionValueDataset.js";

describe("writeApprovedActionValueDataset", () => {
  it("writes a new dataset from base plus approved rows without overwriting base", async () => {
    const preexportRowsPath = "reports/ai-iron/test-step39-preexport.jsonl";
    const outputDatasetPath = "data/ai/action-value/test-iron-step39-action-value.jsonl";
    await buildS02DeepPreExportRows({ outputPath: preexportRowsPath });
    const beforeBase = await fs.stat("data/ai/action-value/iron-step15-action-value.jsonl");
    const result = await writeApprovedActionValueDataset({
      preexportRowsPath,
      outputDatasetPath,
      metadataOutputPath: "reports/ai-iron/test-iron-step39-dataset-write.json",
      determinismAuditPath: "reports/ai-eval/test-replay-determinism-audit-iron-step39.json",
    });
    const afterBase = await fs.stat("data/ai/action-value/iron-step15-action-value.jsonl");

    expect(result.baseRows).toBe(1069);
    expect(result.addedRows).toBe(2);
    expect(result.finalRows).toBe(1071);
    expect(result.baseDatasetOverwritten).toBe(false);
    expect(beforeBase.size).toBe(afterBase.size);
    expect(result.productionDatasetChanged).toBe(false);
  }, 30000);
});
