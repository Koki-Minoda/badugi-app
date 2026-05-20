import { describe, expect, it } from "vitest";

import {
  buildBadugiValueTelemetryFields,
  runBadugiValueBetAudit,
} from "../qa/badugiValuePressureAudit.js";
import { buildCpuDecisionTelemetry } from "../qa/cpuDecisionPersistence.js";

describe("Badugi value pressure audit", () => {
  it("classifies made Badugi value-bet opportunities without exposing private cards", () => {
    const telemetry = buildBadugiValueTelemetryFields({
      hand: ["AS", "2D", "3C", "4H"],
      phase: "BET",
      drawRound: 3,
      betRound: 3,
      legalActions: ["CHECK", "RAISE"],
      toCall: 0,
      activeOpponents: 1,
    });

    expect(telemetry).toMatchObject({
      handStrengthBucket: "made-badugi-strong",
      madeBadugi: true,
      patState: "pat",
      drawCount: 0,
      aggressionOpportunity: true,
      valueBetOpportunity: true,
      showdownEquityBucket: "premium",
      headsUp: true,
    });
    expect(JSON.stringify(telemetry)).not.toContain("AS");
  });

  it("compares heuristic, pro-overlay runtime, and fallback pressure without tuning policy", () => {
    const report = runBadugiValueBetAudit();
    const byPath = Object.fromEntries(report.comparison.map((row) => [row.pathId, row]));

    expect(byPath.heuristic.valueBetOpportunities).toBeGreaterThan(0);
    expect(byPath.heuristic.valueBetFrequency).toBeGreaterThanOrEqual(0.5);
    expect(byPath.heuristic.headsUpPressureFrequency).toBeGreaterThanOrEqual(0.5);

    expect(byPath["pro-overlay"].valueBetOpportunities).toBeGreaterThan(0);
    expect(byPath["pro-overlay"].valueBetFrequency).toBeGreaterThan(0);
    expect(byPath["pro-overlay"].headsUpPressureFrequency).toBeGreaterThan(0);
    expect(byPath["pro-overlay"].adapterMismatches).toBe(0);
    expect(byPath["pro-overlay"].classifications.VALUE_BET_MISSED ?? 0).toBe(0);
    expect(byPath["pro-overlay"].classifications.PRESSURE_MISSING ?? 0).toBeLessThan(
      byPath.fallback.classifications.PRESSURE_MISSING,
    );

    expect(byPath.fallback.valueBetFrequency).toBe(0);
    expect(byPath.fallback.classifications.OVER_PASSIVE_CHECK).toBeGreaterThan(0);
  });

  it("persists expanded Badugi CPU value telemetry fields through the CPU decision row", () => {
    const telemetry = buildCpuDecisionTelemetry({
      sessionId: "badugi-value-audit-session",
      mode: "tournament",
      variantId: "badugi",
      actorSeat: 2,
      seatSnapshot: { isCPU: true, stack: 500, position: "BTN" },
      phase: "BET",
      drawRound: 3,
      betRound: 3,
      actionType: "Check",
      metadata: {
        decisionSource: "pro-overlay",
        legalActions: ["CHECK", "RAISE"],
        handStrengthBucket: "made-badugi-strong",
        madeBadugi: true,
        patState: "pat",
        drawCount: 0,
        streetStrengthEstimate: 0.98,
        aggressionOpportunity: true,
        valueBetOpportunity: true,
        showdownEquityBucket: "premium",
      },
      toCall: 0,
      currentBet: 0,
      pot: 100,
      aiTier: "pro",
      cpuPolicy: "pro",
    });

    expect(telemetry.cpuDecision).toMatchObject({
      decisionSource: "pro-overlay",
      handStrengthBucket: "made-badugi-strong",
      madeBadugi: true,
      patState: "pat",
      drawCount: 0,
      streetStrengthEstimate: 0.98,
      aggressionOpportunity: true,
      valueBetOpportunity: true,
      showdownEquityBucket: "premium",
    });
    expect(telemetry.cpuDecision.hand).toBeUndefined();
  });
});
