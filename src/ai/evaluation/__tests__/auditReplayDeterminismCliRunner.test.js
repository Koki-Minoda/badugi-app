import { describe, expect, it } from "vitest";

import { auditReplayDeterminism } from "../auditReplayDeterminism.js";

function parseArgs() {
  const forwardedArgs = JSON.parse(process.env.MGX_AI_REPLAY_DETERMINISM_ARGS ?? "[]");
  const variantsArg = forwardedArgs.find((entry) => String(entry).startsWith("--variants="));
  const maxSamplesArg = forwardedArgs.find((entry) => String(entry).startsWith("--max-samples="));
  const corpusTagArg = forwardedArgs.find((entry) => String(entry).startsWith("--corpus-tag="));

  return {
    variants:
      typeof variantsArg === "string" && variantsArg.length
        ? variantsArg.replace("--variants=", "").split(",").map((entry) => entry.trim()).filter(Boolean)
        : ["D02", "S01", "S02"],
    maxSamples: Number(String(maxSamplesArg ?? "--max-samples=500").replace("--max-samples=", "")),
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

describe("AI replay determinism CLI runner", () => {
  it("executes the determinism audit without noisy engine logs", async () => {
    const { variants, maxSamples, sampleTagFilter } = parseArgs();
    const originalLog = console.log;
    const originalWarn = console.warn;

    console.log = () => {};
    console.warn = () => {};

    try {
      const { report, outputPath } = await auditReplayDeterminism({
        variants,
        maxSamples,
        sampleTagFilter,
      });
      expect(report.replaySamples).toBeGreaterThan(0);
      expect(typeof report.deterministic).toBe("boolean");
      expect(typeof outputPath).toBe("string");
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
    }
  }, 300000);
});
