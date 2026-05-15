import { describe, expect, it } from "vitest";

import { runCounterfactualDivergenceScore } from "../runCounterfactualDivergenceScore.js";

function parseArgs() {
  const forwardedArgs = JSON.parse(process.env.MGX_AI_COUNTERFACTUAL_ARGS ?? "[]");
  const variantsArg = forwardedArgs.find((entry) => String(entry).startsWith("--variants="));
  const maxSamplesArg = forwardedArgs.find((entry) => String(entry).startsWith("--max-samples="));
  const bucketFilterArg = forwardedArgs.find((entry) => String(entry).startsWith("--bucket-filter="));
  const corpusTagArg = forwardedArgs.find((entry) => String(entry).startsWith("--corpus-tag="));

  return {
    variants:
      typeof variantsArg === "string" && variantsArg.length
        ? variantsArg.replace("--variants=", "").split(",").map((entry) => entry.trim()).filter(Boolean)
        : ["S02", "S01", "D02"],
    maxSamples: Number(String(maxSamplesArg ?? "--max-samples=500").replace("--max-samples=", "")),
    bucketFilter:
      typeof bucketFilterArg === "string" && bucketFilterArg.length
        ? bucketFilterArg
            .replace("--bucket-filter=", "")
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
        : [],
    sampleTagFilter:
      typeof corpusTagArg === "string" && corpusTagArg.length
        ? corpusTagArg
            .replace("--corpus-tag=", "")
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
        : [],
  };
}

describe("AI counterfactual divergence CLI runner", () => {
  it("executes the counterfactual score without noisy engine logs", async () => {
    const { variants, maxSamples, bucketFilter, sampleTagFilter } = parseArgs();
    const originalLog = console.log;
    const originalWarn = console.warn;

    console.log = () => {};
    console.warn = () => {};

    try {
      const { report, outputPath } = await runCounterfactualDivergenceScore({
        variants,
        maxSamples,
        bucketFilter,
        sampleTagFilter,
      });

      expect(report.replaySamples).toBeGreaterThan(0);
      expect(report.bucketResults.length).toBeGreaterThan(0);
      expect(typeof outputPath).toBe("string");
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
    }
  }, 900000);
});
