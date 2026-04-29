import { describe, it, expect } from "vitest";
import { applyForcedBetActionSnapshot } from "../actionUtils.js";

function seat(overrides = {}) {
  return {
    name: "CPU",
    stack: 100,
    betThisRound: 20,
    totalInvested: 20,
    folded: false,
    hasFolded: false,
    seatOut: false,
    allIn: false,
    hasActedThisRound: true,
    lastAction: "Call",
    ...overrides,
  };
}

describe("applyForcedBetActionSnapshot", () => {
  it("reopens action for other active seats after a raise", () => {
    const players = [
      seat({ name: "Seat0", hasActedThisRound: true }),
      seat({ name: "Seat1", hasActedThisRound: true }),
      seat({ name: "Seat2", hasActedThisRound: true }),
    ];

    const result = applyForcedBetActionSnapshot({
      players,
      seat: 1,
      payload: { type: "raise", amount: 20 },
      betSize: 20,
    });

    expect(result.success).toBe(true);
    expect(result.raiseApplied).toBe(true);
    expect(result.updatedPlayers[1].hasActedThisRound).toBe(true);
    expect(result.updatedPlayers[0].hasActedThisRound).toBe(false);
    expect(result.updatedPlayers[2].hasActedThisRound).toBe(false);
  });
});
