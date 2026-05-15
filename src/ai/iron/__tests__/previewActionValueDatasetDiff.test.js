import { describe, expect, it } from "vitest";

import { buildS02DeepPreExportRows } from "../buildS02DeepPreExportRows.js";
import { previewActionValueDatasetDiff } from "../previewActionValueDatasetDiff.js";

describe("previewActionValueDatasetDiff", () => {
  it("projects added rows without mutating the base dataset", async () => {
    const preexportRowsPath = "reports/ai-iron/test-preexport-diff-s02-deep-raisecheck-step38.jsonl";
    await buildS02DeepPreExportRows({ outputPath: preexportRowsPath });
    const preview = await previewActionValueDatasetDiff({
      preexportRowsPath,
      outputPath: "reports/ai-iron/test-dataset-diff-preview-step38.json",
    });

    expect(preview.addedRows).toBe(2);
    expect(preview.projectedRows).toBe(preview.baseRows + 2);
    expect(preview.variantCoverageAfter.S02).toBe((preview.variantCoverageBefore.S02 ?? 0) + 2);
    expect(preview.actualDatasetMutation).toBe(false);
    expect(preview.highRiskFlags).toEqual([]);
  }, 30000);
});
