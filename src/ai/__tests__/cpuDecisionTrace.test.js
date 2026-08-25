import { describe, expect, it } from "vitest";
import {
  buildCpuDecisionTraceRow,
  classifyDecisionSource,
  createCpuDecisionTrace,
} from "../qa/cpuDecisionTrace.js";
import { summarizeCpuDecisionTrace } from "../qa/summarizeCpuDecisionTrace.js";

describe("cpu decision trace", () => {
  it("normalizes source, action, and hand strength fields", () => {
    const row = buildCpuDecisionTraceRow({
      handId: "h1",
      variantId: "D01",
      seat: 2,
      phase: "BET",
      legalActions: ["FOLD", "CALL", "RAISE"],
      selectedAction: "BET",
      metadata: { strategy: "ruleBasedD01", drawCount: 1 },
      currentBet: 0,
      pot: 30,
      stack: 500,
    });

    expect(row.finalAction).toBe("raise");
    expect(row.decisionSource).toBe("heuristic");
    expect(row.handStrengthBucket).toBe("medium");
    expect(row.legalActions).toContain("raise");
  });

  it("summarizes fold, raise, legal raise, and fallback rates", () => {
    const rows = [
      buildCpuDecisionTraceRow({
        variantId: "D01",
        legalActions: ["FOLD", "CALL", "RAISE"],
        selectedAction: "RAISE",
        metadata: { strategy: "ruleBasedD01", drawCount: 0 },
      }),
      buildCpuDecisionTraceRow({
        variantId: "D01",
        legalActions: ["FOLD", "CALL", "RAISE"],
        selectedAction: "FOLD",
        decisionSource: "fallback",
        fallbackReason: "invalid-rl-response",
      }),
      buildCpuDecisionTraceRow({
        variantId: "S01",
        legalActions: ["CHECK"],
        selectedAction: "CHECK",
        metadata: { strategy: "ruleBasedS01", drawCount: 2 },
      }),
    ];

    const summary = summarizeCpuDecisionTrace(rows);
    expect(summary.totalDecisions).toBe(3);
    expect(summary.totals.raises).toBe(1);
    expect(summary.totals.folds).toBe(1);
    expect(summary.totals.legalRaiseSpots).toBe(2);
    expect(summary.byVariant.D01.fallbackRate).toBe(0.5);
    expect(summary.byVariant.S01.checks).toBe(1);
  });

  it("records rows and emits a summary from the trace collector", () => {
    const trace = createCpuDecisionTrace();
    trace.record(
      buildCpuDecisionTraceRow({
        variantId: "D02",
        selectedAction: "CALL",
        legalActions: ["FOLD", "CALL"],
      }),
    );

    expect(trace.rows).toHaveLength(1);
    expect(trace.summarize().byVariant.D02.calls).toBe(1);
  });

  it("classifies pro overlay separately from rule-based heuristic", () => {
    expect(classifyDecisionSource({ strategy: "ruleBasedD01" })).toBe("heuristic");
    expect(
      classifyDecisionSource({ strategy: "pro-d01", decisionSource: "pro-overlay" }, "pro"),
    ).toBe("pro-overlay");
  });
});
