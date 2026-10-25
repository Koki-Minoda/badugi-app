import { describe, expect, it } from "vitest";
import { canStartNextHand } from "../nextHandStartGate.js";

const candidate = (overrides = {}) => ({
  currentPhase: "BET",
  handCount: 8,
  resetPhase: "SAFE_RESET",
  ...overrides,
});

describe("next hand start gate", () => {
  it("accepts a saved cash result even if a late callback restored BET", () => {
    expect(canStartNextHand(candidate({ cashHandSettled: true }))).toBe(true);
  });

  it("does not start a second hand from BET after the saved marker clears", () => {
    expect(canStartNextHand(candidate())).toBe(false);
  });

  it("keeps the existing result, tournament, and first-deal paths", () => {
    expect(canStartNextHand(candidate({ currentPhase: "WAITING_NEXT_HAND" }))).toBe(true);
    expect(canStartNextHand(candidate({ tournamentHandSettled: true }))).toBe(true);
    expect(canStartNextHand(candidate({ handCount: 0 }))).toBe(true);
  });
});
