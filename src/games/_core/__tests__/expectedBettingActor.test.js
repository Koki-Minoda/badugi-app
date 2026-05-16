import { describe, expect, it } from "vitest";
import { expectedFirstActor, expectedNextActor, positionLabelForSeat } from "../audit/expectedBettingActor.js";

const seats = [0, 1, 2, 3, 4, 5];

describe("expected betting actor calculator", () => {
  it("starts 6max pre-draw betting at UTG, not the BB", () => {
    expect(
      expectedFirstActor({
        playerCount: 6,
        buttonSeat: 0,
        sbSeat: 1,
        bbSeat: 2,
        phase: "BET",
        drawRound: 0,
        activeSeats: seats,
      }),
    ).toBe(3);
  });

  it("starts 3way pre-draw betting left of the BB", () => {
    expect(
      expectedFirstActor({
        playerCount: 3,
        buttonSeat: 0,
        sbSeat: 1,
        bbSeat: 2,
        phase: "BET",
        drawRound: 0,
        activeSeats: [0, 1, 2],
      }),
    ).toBe(0);
  });

  it("starts heads-up pre-draw betting at BTN/SB and post-draw at BB", () => {
    expect(
      expectedFirstActor({
        playerCount: 2,
        buttonSeat: 0,
        sbSeat: 0,
        bbSeat: 1,
        phase: "BET",
        drawRound: 0,
        activeSeats: [0, 1],
      }),
    ).toBe(0);
    expect(
      expectedFirstActor({
        playerCount: 2,
        buttonSeat: 0,
        sbSeat: 0,
        bbSeat: 1,
        phase: "BET",
        drawRound: 1,
        activeSeats: [0, 1],
      }),
    ).toBe(1);
  });

  it("starts post-draw betting left of the button", () => {
    expect(
      expectedFirstActor({
        playerCount: 6,
        buttonSeat: 0,
        sbSeat: 1,
        bbSeat: 2,
        phase: "BET",
        drawRound: 1,
        activeSeats: seats,
      }),
    ).toBe(1);
  });

  it("skips folded and all-in seats for first actor", () => {
    expect(
      expectedFirstActor({
        playerCount: 6,
        buttonSeat: 0,
        sbSeat: 1,
        bbSeat: 2,
        phase: "BET",
        drawRound: 0,
        activeSeats: seats,
        foldedSeats: [3],
        allInSeats: [4],
      }),
    ).toBe(5);
  });

  it("keeps BB unresolved until all earlier seats have acted in pre-draw", () => {
    const contributions = { 0: 20, 1: 10, 2: 20, 3: 20, 4: 20, 5: 20 };
    expect(
      expectedNextActor({
        previousActorSeat: 0,
        playerCount: 6,
        activeSeats: seats,
        currentBet: 20,
        contributions,
        actedThisStreet: [3, 4, 5, 0],
      }),
    ).toBe(1);
    expect(
      expectedNextActor({
        previousActorSeat: 1,
        playerCount: 6,
        activeSeats: seats,
        currentBet: 20,
        contributions: { ...contributions, 1: 20 },
        actedThisStreet: [3, 4, 5, 0, 1],
      }),
    ).toBe(2);
  });

  it("returns null when all active seats have acted and matched the current bet", () => {
    expect(
      expectedNextActor({
        previousActorSeat: 2,
        playerCount: 6,
        activeSeats: seats,
        currentBet: 20,
        contributions: { 0: 20, 1: 20, 2: 20, 3: 20, 4: 20, 5: 20 },
        actedThisStreet: seats,
      }),
    ).toBeNull();
  });

  it("labels standard 6max positions from button and blinds", () => {
    expect(positionLabelForSeat({ seat: 3, playerCount: 6, buttonSeat: 0, sbSeat: 1, bbSeat: 2 })).toBe("UTG");
    expect(positionLabelForSeat({ seat: 4, playerCount: 6, buttonSeat: 0, sbSeat: 1, bbSeat: 2 })).toBe("MP");
    expect(positionLabelForSeat({ seat: 5, playerCount: 6, buttonSeat: 0, sbSeat: 1, bbSeat: 2 })).toBe("CO");
    expect(positionLabelForSeat({ seat: null, playerCount: 6, buttonSeat: 0, sbSeat: 1, bbSeat: 2 })).toBe(
      "UNKNOWN",
    );
  });
});
