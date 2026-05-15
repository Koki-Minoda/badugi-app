import { describe, expect, it } from "vitest";

import { buildS02DeepPreExportRows } from "../buildS02DeepPreExportRows.js";
import { finalizeActionValueDatasetDiff } from "../finalizeActionValueDatasetDiff.js";
import { writeApprovedActionValueDataset } from "../writeApprovedActionValueDataset.js";

describe("finalizeActionValueDatasetDiff", () => {
  it("records the final Step39 dataset delta", async () => {
    const preexportRowsPath = "reports/ai-iron/test-step39-diff-preexport.jsonl";
    const finalDatasetPath = "data/ai/action-value/test-iron-step39-diff-action-value.jsonl";
    await buildS02DeepPreExportRows({ outputPath: preexportRowsPath });
    await writeApprovedActionValueDataset({
      preexportRowsPath,
      outputDatasetPath: finalDatasetPath,
      metadataOutputPath: "reports/ai-iron/test-step39-diff-dataset-write.json",
      determinismAuditPath: "reports/ai-eval/test-step39-diff-determinism.json",
    });
    const diff = await finalizeActionValueDatasetDiff({
      finalDatasetPath,
      outputPath: "reports/ai-iron/test-dataset-diff-final-step39.json",
    });

    expect(diff.baseRows).toBe(1069);
    expect(diff.addedRows).toBe(2);
    expect(diff.finalRows).toBe(1071);
    expect(diff.s02RowsAdded).toBe(2);
    expect(diff.verifiedForcedReplayAdded).toBe(2);
    expect(diff.d01RowsUnchanged).toBe(true);
  }, 30000);
});
