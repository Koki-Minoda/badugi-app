import { describe, expect, it } from "vitest";

import { runCounterfactualDivergenceScore } from "../runCounterfactualDivergenceScore.js";

describe("AI counterfactual divergence CLI", () => {
  it("writes the Step4-U counterfactual JSON report", async () => {
    const forwardedArgs = JSON.parse(process.env.MGX_AI_COUNTERFACTUAL_ARGS ?? "[]");
    const variantArg = forwardedArgs.find((entry) => String(entry).startsWith("--variants="));
    const expectedVariants =
      typeof variantArg === "string" && variantArg.length
        ? variantArg.replace("--variants=", "").split(",").map((entry) => entry.trim()).filter(Boolean)
        : ["S02", "S01", "D02"];
    const maxSamplesArg = forwardedArgs.find((entry) => String(entry).startsWith("--max-samples="));
    const maxSamples = Number(String(maxSamplesArg ?? "--max-samples=500").replace("--max-samples=", ""));
    const { report, outputPath } = await runCounterfactualDivergenceScore({
      variants: expectedVariants,
      maxSamples,
    });
    expect(report.replaySamples).toBeGreaterThan(0);
    expect(report.bucketResults.length).toBeGreaterThan(0);
    expect(typeof outputPath).toBe("string");
  }, 30000);
});
