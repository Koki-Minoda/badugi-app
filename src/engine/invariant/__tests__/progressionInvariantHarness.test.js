import { describe, expect, it } from "vitest";
import { createProgressionInvariantHarness } from "../createProgressionInvariantHarness.js";

const players = [
  { name: "Hero", stack: 1000, betThisRound: 20, hasActedThisRound: true, hand: ["AS", "2S", "3S", "4S", "5S"] },
  { name: "CPU", stack: 1000, betThisRound: 20, hasActedThisRound: false, hand: ["KS", "QS", "JS", "9S", "8S"] },
];

describe("progression invariant harness", () => {
  it("records snapshot and action reopen violations", () => {
    const harness = createProgressionInvariantHarness({ variantId: "D01", mode: "cash", handSize: 5, maxDraws: 3 });
    harness.recordSnapshot({ handId: "h1", phase: "BET", currentBet: 20, pot: 40, turn: 1, players });
    harness.recordAction({ handId: "h1", phase: "BET", actorSeat: 0, action: "RAISE" });
    harness.recordAction({ handId: "h1", phase: "BET", actorSeat: 0, action: "CALL" });
    const result = harness.finalize();
    expect(result.status).toBe("FAIL");
    expect(result.violations.some((violation) => violation.type === "ILLEGAL_RAISER_REACTION")).toBe(true);
  });
});

