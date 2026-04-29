import { describe, expect, it } from "vitest";
import { resolveBadugiWinners } from "../src/games/badugi/engine/badugiComparison.js";

// Regression: 4-card Badugi must always beat 3-card hands.
describe("badugi winner regression", () => {
  it("never selects a 3-card hand over an available 4-card Badugi", () => {
    const contenders = [
      {
        seatIndex: 0,
        name: "FourCard",
        hand: ["7C", "4H", "5S", "8D"],
      },
      {
        seatIndex: 1,
        name: "ThreeCard",
        hand: ["AD", "7H", "JH", "10S"],
      },
    ];

    const winners = resolveBadugiWinners(contenders);
    expect(winners).toHaveLength(1);
    expect(winners[0]?.seatIndex).toBe(0);
  });
});
