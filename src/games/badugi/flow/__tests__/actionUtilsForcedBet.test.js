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

  it("does not treat a short all-in facing a bet as a full raise", () => {
    const players = [
      seat({ name: "Hero", betThisRound: 40, hasActedThisRound: true }),
      seat({
        name: "Short stack",
        stack: 20,
        betThisRound: 0,
        totalInvested: 0,
        hasActedThisRound: false,
      }),
      seat({ name: "Caller", betThisRound: 40, hasActedThisRound: true }),
    ];

    const result = applyForcedBetActionSnapshot({
      players,
      seat: 1,
      payload: { type: "raise", amount: 20 },
      betSize: 20,
    });

    expect(result.success).toBe(true);
    expect(result.raiseApplied).toBe(false);
    expect(result.updatedPlayers[1]).toMatchObject({
      stack: 0,
      betThisRound: 20,
      allIn: true,
      lastAction: "Call",
      hasActedThisRound: true,
    });
    expect(result.updatedPlayers[0].hasActedThisRound).toBe(true);
    expect(result.updatedPlayers[2].hasActedThisRound).toBe(true);
  });

  it("forces an invalid under-call to the full to-call when the stack can cover it", () => {
    const players = [
      seat({ name: "Hero", betThisRound: 40 }),
      seat({
        name: "Caller",
        stack: 100,
        betThisRound: 0,
        totalInvested: 0,
        hasActedThisRound: false,
      }),
    ];

    const result = applyForcedBetActionSnapshot({
      players,
      seat: 1,
      payload: { type: "call", amount: 20 },
      betSize: 20,
    });

    expect(result.success).toBe(true);
    expect(result.updatedPlayers[1]).toMatchObject({
      stack: 60,
      betThisRound: 40,
      lastAction: "Call",
    });
  });
});
