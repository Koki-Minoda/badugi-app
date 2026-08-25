import { describe, expect, it, vi } from "vitest";
import { resolveOpeningBetActor } from "../actionUtils.js";

function seat(overrides = {}) {
  return {
    stack: 500,
    folded: false,
    hasFolded: false,
    seatOut: false,
    isBusted: false,
    sittingOut: false,
    allIn: false,
    ...overrides,
  };
}

function seats(count, overrides = {}) {
  return Array.from({ length: count }, (_, idx) => seat(overrides[idx] ?? {}));
}

describe("resolveOpeningBetActor", () => {
  it.each([
    ["6max", 6, 3],
    ["5max", 5, 3],
    ["4max", 4, 3],
    ["3max", 3, 0],
  ])("%s starts BET R1 at the first eligible seat left of BB", (_label, count, expected) => {
    expect(
      resolveOpeningBetActor({
        seats: seats(count),
        buttonSeat: 0,
        smallBlindSeat: 1,
        bigBlindSeat: 2,
        phase: "BET",
        round: 1,
      }),
    ).toBe(expected);
  });

  it("starts heads-up BET R1 at BTN/SB", () => {
    expect(
      resolveOpeningBetActor({
        seats: seats(2),
        buttonSeat: 0,
        smallBlindSeat: 0,
        bigBlindSeat: 1,
        phase: "BET",
        round: 1,
      }),
    ).toBe(0);
  });

  it.each([
    ["folded", { folded: true }],
    ["busted", { isBusted: true }],
    ["sitting out", { sittingOut: true }],
    ["all-in", { allIn: true }],
    ["stack zero", { stack: 0 }],
  ])("skips an ineligible UTG seat when it is %s", (_label, override) => {
    expect(
      resolveOpeningBetActor({
        seats: seats(6, { 3: override }),
        buttonSeat: 0,
        smallBlindSeat: 1,
        bigBlindSeat: 2,
        phase: "BET",
        round: 1,
      }),
    ).toBe(4);
  });

  it("returns null when fewer than two seats can act", () => {
    expect(
      resolveOpeningBetActor({
        seats: seats(3, {
          0: { stack: 0 },
          1: { allIn: true },
        }),
        buttonSeat: 0,
        smallBlindSeat: 1,
        bigBlindSeat: 2,
        phase: "BET",
        round: 1,
      }),
    ).toBeNull();
  });

  it("emits opening actor diagnostic context via debugLog", () => {
    // debugLog routes through console.log with a formatted string prefix.
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    resolveOpeningBetActor({
      seats: seats(6),
      buttonSeat: 0,
      smallBlindSeat: 1,
      bigBlindSeat: 2,
      phase: "BET",
      round: 1,
    });

    // debugLog call signature: console.log(`%c[time] TAG msg`, color, payload)
    const diagnosticCall = spy.mock.calls.find(
      ([msg]) => typeof msg === "string" && msg.includes("[BET][OPENING_ACTOR]"),
    );
    expect(diagnosticCall).toBeTruthy();
    // payload is the third argument (after the formatted string and the color)
    expect(diagnosticCall[2]).toMatchObject({
      buttonSeat: 0,
      sbSeat: 1,
      bbSeat: 2,
      resolvedOpeningActor: 3,
      activeEligibleSeats: [0, 1, 2, 3, 4, 5],
      round: 1,
      phase: "BET",
    });
    spy.mockRestore();
  });
});
