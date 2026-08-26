import { describe, expect, it } from "vitest";
import { createProgressHarness, runProgressScenario, resolveScenarioHandCount, snapshotOf } from "./runProgressScenario.js";

function dealtCards(snapshot) {
  return {
    board: snapshot.boardCards,
    holes: snapshot.players.map((player) => player.holeCards ?? player.hand ?? []),
  };
}

describe("deterministic real multi-hand progress scenarios", () => {
  it("parses the requested hand count instead of treating it as a label", () => {
    expect(resolveScenarioHandCount("cash-10-hands-smoke")).toBe(10);
    expect(resolveScenarioHandCount("tournament-50-hands-smoke")).toBe(50);
    expect(resolveScenarioHandCount("draw-count-full-cycle")).toBe(1);
  });

  it("injects a seed into the actual NLH deck shuffle", () => {
    const first = snapshotOf(createProgressHarness("B01", { seed: "same-seed" }));
    const second = snapshotOf(createProgressHarness("B01", { seed: "same-seed" }));
    const different = snapshotOf(createProgressHarness("B01", { seed: "different-seed" }));
    expect(dealtCards(first)).toEqual(dealtCards(second));
    expect(dealtCards(first)).not.toEqual(dealtCards(different));
  });

  it("executes and strictly settles all ten NLH hands", () => {
    const result = runProgressScenario({
      variantId: "B01",
      scenarioId: "cash-10-hands-smoke",
      seed: "nlh-real-ten-hand",
      maxSteps: 100,
    });
    expect(result.status).toBe("passed");
    expect(result.handsCompleted).toBe(10);
    expect(result.targetHandCount).toBe(10);
    expect(result.strictSettlements).toHaveLength(10);
    expect(result.strictSettlements.every((entry) => entry.status === "ENFORCED" && entry.ok)).toBe(true);
  });
});
