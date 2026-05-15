import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createIronCandidatePolicy } from "../ironCandidatePolicy.js";

const tempDirs = [];

function buildRow() {
  return {
    variantId: "D02",
    schemaVersion: 1,
    observation: Array.from({ length: 96 }, () => 0),
    legalActions: [{ type: "FOLD" }, { type: "CALL" }, { type: "RAISE" }],
    candidateActions: [
      { action: { type: "FOLD" }, source: "pro", estimatedValue: 0, sampleCount: 50, confidence: 1, verdict: "BAD" },
      { action: { type: "RAISE" }, source: "standard", estimatedValue: 10, sampleCount: 50, confidence: 1, verdict: "GOOD" },
    ],
    chosenBestAction: { type: "RAISE" },
    handClass: "strongA5",
    bucket: "strongA5 second-pressure",
    sourceCorpusTag: "iron-step7",
    sourceCounterfactualScore: "/tmp/counterfactual.json",
    trainingWeight: 1,
    metadata: { seed: 1, handId: 1, step: 1, actorSeat: 0, counterfactualVerdict: "STABLE_STANDARD_BETTER" },
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("iron candidate policy", () => {
  it("uses dataset action when bucket matches and action is legal", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "iron-policy-"));
    tempDirs.push(dir);
    const datasetPath = path.join(dir, "iron-step7-action-value.jsonl");
    await fs.writeFile(datasetPath, `${JSON.stringify(buildRow())}\n`, "utf8");
    const policy = await createIronCandidatePolicy({ datasetPath });
    const snapshot = {
      currentBet: 40,
      metadata: { raiseCountThisRound: 1 },
      players: [
        { hand: ["7h", "5d", "4c", "3s", "ah"], betThisRound: 0 },
      ],
    };
    const decision = await policy.chooseAction({
      variantId: "D02",
      snapshot,
      seatIndex: 0,
      legalActions: [{ type: "FOLD" }, { type: "CALL" }, { type: "RAISE" }],
      fallbackDecisionFactory: async () => ({ type: "FOLD", metadata: { decisionSource: "pro-overlay" } }),
    });
    expect(decision.type).toBe("RAISE");
    expect(decision.metadata.ironDryRunMatched).toBe(true);
    expect(decision.metadata.ironDryRunFallback).toBe(false);
  });

  it("falls back to pro when dataset action is not legal", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "iron-policy-"));
    tempDirs.push(dir);
    const datasetPath = path.join(dir, "iron-step7-action-value.jsonl");
    await fs.writeFile(datasetPath, `${JSON.stringify(buildRow())}\n`, "utf8");
    const policy = await createIronCandidatePolicy({ datasetPath });
    const snapshot = {
      currentBet: 40,
      metadata: { raiseCountThisRound: 1 },
      players: [
        { hand: ["7h", "5d", "4c", "3s", "ah"], betThisRound: 0 },
      ],
    };
    const decision = await policy.chooseAction({
      variantId: "D02",
      snapshot,
      seatIndex: 0,
      legalActions: [{ type: "FOLD" }, { type: "CALL" }],
      fallbackDecisionFactory: async () => ({ type: "CALL", metadata: { decisionSource: "pro-overlay" } }),
    });
    expect(decision.type).toBe("CALL");
    expect(decision.metadata.ironDryRunMatched).toBe(false);
    expect(decision.metadata.ironDryRunFallback).toBe(true);
  });
});
