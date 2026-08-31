import { describe, expect, test } from "vitest";
import { runProgressScenario } from "./runProgressScenario.js";

const CASES = [
  { variantId: "ST2", label: "Stud 8 or Better" },
  { variantId: "ST3", label: "Razz" },
];

describe("Stud-family 20-hand QA/QM gate", () => {
  test.each(CASES)("$variantId $label completes and strictly settles 20 six-max hands", ({ variantId }) => {
    const result = runProgressScenario({
      variantId,
      scenarioId: "cash-20-hands-qa-qm",
      handCount: 20,
      seed: `stud-qa-qm-20-${variantId}`,
      maxSteps: 320,
    });

    expect(result.status).toBe("passed");
    expect(result.handsCompleted).toBe(20);
    expect(result.targetHandCount).toBe(20);
    expect(result.visited.filter((phase) => phase === "SHOWDOWN")).toHaveLength(20);
    expect(result.strictSettlements).toHaveLength(20);
    expect(result.strictSettlements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "ENFORCED", ok: true }),
      ]),
    );
    expect(result.strictSettlements.every((settlement) => settlement.ok)).toBe(true);
  });
});
