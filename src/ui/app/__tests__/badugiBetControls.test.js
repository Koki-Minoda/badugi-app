import { describe, expect, it } from "vitest";
import { resolveBadugiBetControls } from "../badugiBetControls.js";
import { getAvailableActions } from "../../utils/getAvailableActions.js";

describe("Badugi betting controls", () => {
  it("offers a free check after a street resets even if cached currentBet is stale", () => {
    const result = resolveBadugiBetControls({
      phase: "BET",
      currentBet: 60,
      players: [
        { stack: 400, betThisRound: 0 },
        { stack: 400, betThisRound: 0 },
      ],
    });
    expect(result).toEqual({ currentBet: 0, heroBet: 0, heroStack: 400 });
    expect(getAvailableActions({
      currentBet: result.currentBet,
      player: { stack: result.heroStack, betThisRound: result.heroBet },
      legalActions: [{ type: "CHECK" }, { type: "RAISE" }, { type: "FOLD" }],
    }).map((action) => action.key)).toEqual(["CHECK", "RAISE", "FOLD"]);
  });

  it("uses the largest live street commitment, not a stale 60-chip cache", () => {
    const result = resolveBadugiBetControls({
      phase: "BET",
      currentBet: 60,
      players: [
        { stack: 400, betThisRound: 0 },
        { stack: 400, betThisRound: 40 },
        { stack: 400, betThisRound: 80, folded: true },
      ],
    });
    expect(result).toMatchObject({ currentBet: 40, heroBet: 0 });
    expect(getAvailableActions({
      currentBet: result.currentBet,
      player: { stack: result.heroStack, betThisRound: result.heroBet },
      legalActions: [{ type: "CALL" }, { type: "RAISE" }, { type: "FOLD" }],
    }).find((action) => action.key === "CALL")?.label).toBe("Call 40");
  });

  it("allows a check when the hero has already matched 40 this street", () => {
    const result = resolveBadugiBetControls({
      phase: "BET",
      currentBet: 60,
      players: [
        { stack: 380, betThisRound: 40, betThisStreet: 0 },
        { stack: 380, betThisRound: 40 },
      ],
    });
    expect(result.currentBet - result.heroBet).toBe(0);
    expect(getAvailableActions({
      currentBet: result.currentBet,
      player: { stack: result.heroStack, betThisRound: result.heroBet },
      legalActions: [{ type: "CHECK" }, { type: "RAISE" }, { type: "FOLD" }],
    }).map((action) => action.key)).toContain("CHECK");
  });
});
