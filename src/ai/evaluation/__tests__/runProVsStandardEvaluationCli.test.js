import { describe, expect, it } from "vitest";

import { runEvaluationCli } from "../runProVsStandardEvaluation.js";

describe("AI pro evaluation CLI", () => {
  it("writes the Step3 evaluation JSON report", async () => {
    const forwardedArgs = JSON.parse(process.env.MGX_AI_EVAL_ARGS ?? "[]");
    const variantArg = forwardedArgs.find((entry) => String(entry).startsWith("--variants="));
    const expectedVariants =
      typeof variantArg === "string" && variantArg.length
        ? variantArg.replace("--variants=", "").split(",").map((entry) => entry.trim()).filter(Boolean)
        : ["D03"];
    const { summary, outputPath } = await runEvaluationCli(forwardedArgs);
    expect(summary.runId).toMatch(/^pro-vs-standard-\d+$/);
    expect(summary.variants[expectedVariants[0]]).toBeTruthy();
    expect(typeof outputPath).toBe("string");
  }, 30000);
});
