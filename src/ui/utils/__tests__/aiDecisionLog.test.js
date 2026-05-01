import { describe, expect, it } from "vitest";
import { extractAiDecisionEntry, summarizeAiDecisionLog } from "../aiDecisionLog.js";

describe("aiDecisionLog", () => {
  it("extracts bet decision metadata from action log entries", () => {
    const entry = extractAiDecisionEntry({
      handId: "h1",
      seat: 2,
      seatName: "CPU 2",
      phase: "BET",
      action: "Raise",
      ts: 100,
      metadata: {
        decisionSource: "policy-router",
        tierId: "pro",
        decisionReason: "value",
      },
    });

    expect(entry).toMatchObject({
      handId: "h1",
      seat: 2,
      seatName: "CPU 2",
      phase: "BET",
      action: "Raise",
      source: "policy-router",
      tierId: "pro",
      reason: "value",
    });
  });

  it("extracts draw decision metadata from nested drawInfo", () => {
    const entry = extractAiDecisionEntry({
      handId: "h2",
      seat: 3,
      phase: "DRAW",
      action: "DRAW(1)",
      metadata: {
        drawInfo: {
          decisionSource: "policy-router",
          tierId: "standard",
          drawIndexes: [2],
        },
      },
    });

    expect(entry).toMatchObject({
      source: "policy-router",
      tierId: "standard",
      discardIndexes: [2],
    });
  });

  it("summarizes recent decisions by tier and source", () => {
    const summary = summarizeAiDecisionLog(
      [
        {
          seat: 1,
          phase: "BET",
          action: "Call",
          ts: 1,
          metadata: { decisionSource: "policy-router", tierId: "standard" },
        },
        {
          seat: 2,
          phase: "DRAW",
          action: "Pat",
          ts: 2,
          metadata: {
            drawInfo: { decisionSource: "policy-router", tierId: "pro", drawIndexes: [] },
          },
        },
      ],
      { limit: 1 },
    );

    expect(summary.total).toBe(2);
    expect(summary.bySource).toEqual({ "policy-router": 2 });
    expect(summary.byTier).toEqual({ standard: 1, pro: 1 });
    expect(summary.recent).toHaveLength(1);
    expect(summary.recent[0].tierId).toBe("pro");
  });
});
