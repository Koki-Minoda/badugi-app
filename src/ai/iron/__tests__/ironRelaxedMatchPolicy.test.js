import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createIronCandidatePolicy } from "../ironCandidatePolicy.js";

const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

function buildRelaxedRow() {
  return {
    variantId: "S02",
    schemaVersion: 1,
    observation: Array.from({ length: 96 }, () => 0),
    legalActions: [{ type: "FOLD" }, { type: "CALL" }, { type: "RAISE" }],
    candidateActions: [
      { action: { type: "FOLD" }, source: "pro", estimatedValue: 0, sampleCount: 60, confidence: 1, verdict: "BAD" },
      { action: { type: "RAISE" }, source: "counterfactual", estimatedValue: 10, sampleCount: 60, confidence: 1, verdict: "GOOD" },
    ],
    chosenBestAction: { type: "RAISE" },
    handClass: "strongSDA5",
    bucket: "strongSDA5 CALL/FOLD/RAISE::pc=3way::pos=IP::call=small::repeat=repeated::relaxed-pressureChain=firstRaiseAfterCall|repeatedPressure",
    sourceCorpusTag: "iron-step15",
    sourceCounterfactualScore: "/tmp/step15.json",
    trainingWeight: 1,
    sourceType: "verified-relaxed-match",
    parentStableBucket: "strongSDA5 CALL/FOLD/RAISE::pc=3way::pos=IP::call=small::repeat=repeated",
    parentIsolatedBucket: "strongSDA5 CALL/FOLD/RAISE::pc=3way::pos=IP::call=small::repeat=repeated",
    relaxedAxes: ["pressureChain"],
    relaxedAxisValues: {
      pressureChain: ["firstRaiseAfterCall", "repeatedPressure"],
    },
    metadata: {
      sampleTag: "iron-step15",
      sourceType: "verified-relaxed-match",
      parentStableBucket: "strongSDA5 CALL/FOLD/RAISE::pc=3way::pos=IP::call=small::repeat=repeated",
      relaxedAxes: ["pressureChain"],
      relaxedAxisValues: {
        pressureChain: ["firstRaiseAfterCall", "repeatedPressure"],
      },
    },
  };
}

describe("iron relaxed match policy", () => {
  it("uses replay-verified relaxed match when the live state fits the relaxed axis", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "iron-relaxed-policy-"));
    tempDirs.push(dir);
    const datasetPath = path.join(dir, "iron-step15-action-value.jsonl");
    await fs.writeFile(datasetPath, `${JSON.stringify(buildRelaxedRow())}\n`, "utf8");
    const policy = await createIronCandidatePolicy({ datasetPath });
    const snapshot = {
      dealerIndex: 1,
      currentBet: 30,
      drawRound: 1,
      metadata: {
        currentBet: 30,
        raiseCountThisRound: 1,
        lastBettingAction: { type: "CALL" },
      },
      players: [
        { hand: ["AS", "2D", "4C", "5H", "7S"], betThisRound: 0, stack: 500 },
        { hand: ["2c"], betThisRound: 30, stack: 500 },
        { hand: ["kc"], betThisRound: 30, stack: 500 },
      ],
    };
    const decision = await policy.chooseAction({
      variantId: "S02",
      snapshot,
      seatIndex: 0,
      legalActions: [{ type: "FOLD" }, { type: "CALL", toCall: 30 }, { type: "RAISE", toCall: 30 }],
      fallbackDecisionFactory: async () => ({ type: "CALL", metadata: { decisionSource: "pro-overlay" } }),
    });
    expect(decision.type).toBe("RAISE");
    expect(decision.metadata.ironDryRunMatched).toBe(true);
    expect(decision.metadata.matchedSourceType).toBe("verified-relaxed-match");
  });
});
