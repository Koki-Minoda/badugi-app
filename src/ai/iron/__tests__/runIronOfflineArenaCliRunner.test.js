import { describe, expect, it } from "vitest";

import { runIronOfflineArena } from "../runIronOfflineArena.js";

function parseArgs() {
  const forwardedArgs = JSON.parse(process.env.MGX_AI_IRON_ARENA_ARGS ?? "[]");
  const datasetArg = forwardedArgs.find((entry) => String(entry).startsWith("--dataset="));
  const variantsArg = forwardedArgs.find((entry) => String(entry).startsWith("--variants="));
  const handsArg = forwardedArgs.find((entry) => String(entry).startsWith("--hands="));
  const seedsArg = forwardedArgs.find((entry) => String(entry).startsWith("--seeds="));
  const targetBucketArg = forwardedArgs.find((entry) => String(entry).startsWith("--target-bucket="));
  const targetMinOpportunitiesArg = forwardedArgs.find((entry) =>
    String(entry).startsWith("--target-min-opportunities="),
  );
  const outputArg = forwardedArgs.find((entry) => String(entry).startsWith("--output="));
  const stabilityOutputArg = forwardedArgs.find((entry) => String(entry).startsWith("--stability-output="));
  const dryRunGateOutputArg = forwardedArgs.find((entry) => String(entry).startsWith("--dryrun-gate-output="));
  const targetedSampling = forwardedArgs.includes("--targeted-sampling");
  const targetPlayerCountArg = forwardedArgs.find((entry) => String(entry).startsWith("--target-player-count="));
  const targetHandclassArg = forwardedArgs.find((entry) => String(entry).startsWith("--target-handclass="));
  const targetPositionArg = forwardedArgs.find((entry) => String(entry).startsWith("--target-position="));
  const targetCallBandArg = forwardedArgs.find((entry) => String(entry).startsWith("--target-call-band="));
  const targetPressureChainArg = forwardedArgs.find((entry) => String(entry).startsWith("--target-pressure-chain="));
  const targetMinExactOpportunitiesArg = forwardedArgs.find((entry) =>
    String(entry).startsWith("--target-min-exact-opportunities="),
  );
  const maxHandsArg = forwardedArgs.find((entry) => String(entry).startsWith("--max-hands="));
  const maxDecisionsArg = forwardedArgs.find((entry) => String(entry).startsWith("--max-decisions="));
  const replayCompatiblePlayercount = forwardedArgs.includes("--replay-compatible-playercount");
  const replayCompatibleCallband = forwardedArgs.includes("--replay-compatible-callband");
  const replayCompatiblePressurechain = forwardedArgs.includes("--replay-compatible-pressurechain");
  const naturalMixedExposure = forwardedArgs.includes("--natural-mixed-exposure");

  return {
    datasetPath:
      typeof datasetArg === "string" && datasetArg.length
        ? datasetArg.replace("--dataset=", "")
        : "data/ai/action-value/iron-step7-action-value.jsonl",
    variants:
      typeof variantsArg === "string" && variantsArg.length
        ? variantsArg.replace("--variants=", "").split(",").map((entry) => entry.trim()).filter(Boolean)
        : ["D02", "S01", "S02"],
    hands: Number(String(handsArg ?? "--hands=300").replace("--hands=", "")),
    seeds:
      typeof seedsArg === "string" && seedsArg.length
        ? seedsArg
            .replace("--seeds=", "")
            .split(",")
            .map((entry) => Number(entry.trim()))
            .filter(Number.isFinite)
        : [20260524, 20260525, 20260526],
    targetBucket:
      typeof targetBucketArg === "string" && targetBucketArg.length
        ? targetBucketArg.replace("--target-bucket=", "")
        : null,
    targetedSampling,
    targetMinOpportunities: Number(
      String(targetMinOpportunitiesArg ?? "--target-min-opportunities=20").replace("--target-min-opportunities=", ""),
    ),
    targetPlayerCount: Number(String(targetPlayerCountArg ?? "--target-player-count=0").replace("--target-player-count=", "")),
    targetHandclass:
      typeof targetHandclassArg === "string" && targetHandclassArg.length
        ? targetHandclassArg.replace("--target-handclass=", "")
        : null,
    targetPosition:
      typeof targetPositionArg === "string" && targetPositionArg.length
        ? targetPositionArg.replace("--target-position=", "")
        : null,
    targetCallBand:
      typeof targetCallBandArg === "string" && targetCallBandArg.length
        ? targetCallBandArg.replace("--target-call-band=", "")
        : null,
    targetPressureChain:
      typeof targetPressureChainArg === "string" && targetPressureChainArg.length
        ? targetPressureChainArg.replace("--target-pressure-chain=", "").split(",").map((entry) => entry.trim()).filter(Boolean)
        : [],
    targetMinExactOpportunities: Number(
      String(targetMinExactOpportunitiesArg ?? "--target-min-exact-opportunities=0").replace(
        "--target-min-exact-opportunities=",
        "",
      ),
    ),
    maxHands: Number(String(maxHandsArg ?? "--max-hands=0").replace("--max-hands=", "")),
    maxDecisions: Number(String(maxDecisionsArg ?? "--max-decisions=0").replace("--max-decisions=", "")),
    replayCompatiblePlayercount,
    replayCompatibleCallband,
    replayCompatiblePressurechain,
    naturalMixedExposure,
    outputPath:
      typeof outputArg === "string" && outputArg.length
        ? outputArg.replace("--output=", "")
        : null,
    stabilityOutputPath:
      typeof stabilityOutputArg === "string" && stabilityOutputArg.length
        ? stabilityOutputArg.replace("--stability-output=", "")
        : null,
    dryRunGateOutputPath:
      typeof dryRunGateOutputArg === "string" && dryRunGateOutputArg.length
        ? dryRunGateOutputArg.replace("--dryrun-gate-output=", "")
        : null,
  };
}

describe("iron offline arena CLI runner", () => {
  it("executes the arena dry-run without routing mutation", async () => {
    const {
      datasetPath,
      variants,
      hands,
      seeds,
      targetBucket,
      targetedSampling,
      targetMinOpportunities,
      outputPath,
      stabilityOutputPath,
      dryRunGateOutputPath,
      targetPlayerCount,
      targetHandclass,
      targetPosition,
      targetCallBand,
      targetPressureChain,
      targetMinExactOpportunities,
      maxHands,
      maxDecisions,
      replayCompatiblePlayercount,
      replayCompatibleCallband,
      replayCompatiblePressurechain,
      naturalMixedExposure,
    } = parseArgs();
    const originalLog = console.log;
    const originalWarn = console.warn;

    console.log = () => {};
    console.warn = () => {};

    try {
      const report = await runIronOfflineArena({
        datasetPath,
        variants,
        hands,
        seeds,
        targetBucket,
        targetedSampling,
        targetMinOpportunities,
        targetPlayerCount,
        targetHandclass,
        targetPosition,
        targetCallBand,
        targetPressureChain,
        targetMinExactOpportunities,
        maxHands,
        maxDecisions,
        replayCompatiblePlayercount,
        replayCompatibleCallband,
        replayCompatiblePressurechain,
        naturalMixedExposure,
        outputPath,
        stabilityOutputPath,
        dryRunGateOutputPath,
      });
      expect(report.candidate).toBe("iron-candidate-dryrun");
      expect(report.promoted).toBe(false);
      expect(report.eligibleForPromotion).toBe(false);
      expect(report.routingChanged).toBe(false);
      expect(report.results.length).toBeGreaterThan(0);
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
    }
  }, 900000);
});
