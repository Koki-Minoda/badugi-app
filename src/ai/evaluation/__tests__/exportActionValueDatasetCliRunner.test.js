import { describe, expect, it } from "vitest";

import { exportActionValueDataset } from "../exportActionValueDataset.js";

function parseArgs() {
  const forwardedArgs = JSON.parse(process.env.MGX_AI_EXPORT_ACTION_VALUE_ARGS ?? "[]");
  const variantsArg = forwardedArgs.find((entry) => String(entry).startsWith("--variants="));
  const corpusTagArg = forwardedArgs.find((entry) => String(entry).startsWith("--corpus-tag="));
  const datasetArg = forwardedArgs.find((entry) => String(entry).startsWith("--dataset="));

  return {
    variants:
      typeof variantsArg === "string" && variantsArg.length
        ? variantsArg.replace("--variants=", "").split(",").map((entry) => entry.trim()).filter(Boolean)
        : ["D02", "S01", "S02"],
    sampleTag: typeof corpusTagArg === "string" && corpusTagArg.length ? corpusTagArg.replace("--corpus-tag=", "") : "step4y",
    datasetPath:
      typeof datasetArg === "string" && datasetArg.length
        ? datasetArg.replace("--dataset=", "")
        : null,
  };
}

describe("AI export action value CLI runner", () => {
  it("executes dataset export without direct node jsx imports", async () => {
    const { variants, sampleTag, datasetPath } = parseArgs();
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};
    try {
      const result = await exportActionValueDataset({
        variants,
        sampleTag,
        datasetPath,
      });
      expect(result.rowCount).toBeGreaterThanOrEqual(0);
      expect(typeof result.outputPath).toBe("string");
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
    }
  }, 900000);
});
