import { describe, expect, it } from "vitest";

import { buildS02DeepPreExportRows } from "../buildS02DeepPreExportRows.js";
import { validatePreExportPackage } from "../validatePreExportPackage.js";

describe("validatePreExportPackage", () => {
  it("passes the verified forced-replay preview rows", async () => {
    const preexportRowsPath = "reports/ai-iron/test-preexport-validation-s02-deep-raisecheck-step38.jsonl";
    await buildS02DeepPreExportRows({ outputPath: preexportRowsPath });
    const validation = await validatePreExportPackage({
      preexportRowsPath,
      outputPath: "reports/ai-iron/test-preexport-validation-step38.json",
    });

    expect(validation.status).toBe("PASS");
    expect(validation.validRows).toBe(2);
    expect(validation.gates.schema).toBe("PASS");
    expect(validation.gates.forcedReplayMetadata).toBe("PASS");
    expect(validation.gates.governanceFreeze).toBe("PASS");
  }, 30000);
});
