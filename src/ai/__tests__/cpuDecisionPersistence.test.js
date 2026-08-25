import { describe, expect, it } from "vitest";
import {
  buildCpuDecisionTelemetry,
  mergeCpuDecisionTelemetry,
} from "../qa/cpuDecisionPersistence.js";

describe("cpu decision persistence", () => {
  it("builds minimal CPU metadata without private cards or state vectors", () => {
    const telemetry = buildCpuDecisionTelemetry({
      sessionId: "qa-session-1",
      mode: "cash",
      variantId: "D01",
      actorSeat: 2,
      seatSnapshot: { isCPU: true, stack: 580, position: "UTG" },
      phase: "BET",
      drawRound: 1,
      betRound: 1,
      actionType: "Fold",
      metadata: {
        decisionSource: "pro-overlay",
        legalActions: ["FOLD", "CALL", "RAISE"],
        rawStateVector: [1, 2, 3],
        hand: ["As", "2d"],
      },
      toCall: 20,
      currentBet: 20,
      pot: 30,
      canRaise: true,
      aiTier: "pro",
    });

    expect(telemetry.isCpu).toBe(true);
    expect(telemetry.sessionId).toBe("qa-session-1");
    expect(telemetry.decisionSource).toBe("pro-overlay");
    expect(telemetry.legalActions).toEqual(["fold", "call", "raise"]);
    expect(telemetry.cpuDecision.finalAction).toBe("fold");
    expect(telemetry.cpuDecision.hand).toBeUndefined();
    expect(telemetry.cpuDecision.rawStateVector).toBeUndefined();
  });

  it("returns null for hero or unknown non-CPU seats", () => {
    expect(
      buildCpuDecisionTelemetry({
        seatSnapshot: { isCPU: false, name: "You" },
        actionType: "Call",
      }),
    ).toBeNull();
  });

  it("merges flat and nested metadata for DB action rows", () => {
    const telemetry = buildCpuDecisionTelemetry({
      sessionId: "qa-session-2",
      mode: "tournament",
      variantId: "badugi",
      actorSeat: 3,
      seatSnapshot: { seatType: "CPU", stack: 500 },
      phase: "DRAW",
      actionType: "DRAW(1)",
      metadata: { drawInfo: { drawCount: 1 } },
    });
    const merged = mergeCpuDecisionTelemetry({ actionId: "a1" }, telemetry);

    expect(merged.actionId).toBe("a1");
    expect(merged.isCpu).toBe(true);
    expect(merged.mode).toBe("tournament");
    expect(merged.variantId).toBe("badugi");
    expect(merged.cpuDecision.sessionId).toBe("qa-session-2");
    expect(merged.cpuDecision.legalActions).toEqual(["draw"]);
  });
});
