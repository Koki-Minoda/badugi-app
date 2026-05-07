import { describe, expect, it } from "vitest";

import { runEvaluationCli } from "../runProVsStandardEvaluation.js";

describe("AI pro evaluation CLI", () => {
  it("writes the Step3 evaluation JSON report", async () => {
    const forwardedArgs = JSON.parse(process.env.MGX_AI_EVAL_ARGS ?? "[]");
    const { summary, outputPath } = await runEvaluationCli(forwardedArgs);
    expect(summary.runId).toMatch(/^pro-vs-standard-\d+$/);
    expect(summary.variants.D03).toBeTruthy();
    expect(typeof outputPath).toBe("string");
  }, 30000);
});
