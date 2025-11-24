import React from "react";
import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import HandResultOverlay from "../HandResultOverlay.jsx";

const baseWinner = {
  seatIndex: 0,
  name: "You",
  hand: ["AD", "4C", "7H", "KS"],
  handLabel: "Badugi 4-card",
  ranksLabel: "A-4-7-K",
  activeCards: ["AD", "4C", "7H", "KS"],
  deadCards: [],
  payout: 100,
};

const baseSummary = {
  handId: 1,
  pot: 100,
  winners: [baseWinner],
};

describe("HandResultOverlay", () => {
  afterEach(() => {
    cleanup();
  });
  test("hides pot breakdown when only single pot exists", () => {
    render(
      <HandResultOverlay
        visible
        summary={{
          ...baseSummary,
          potDetails: [
            {
              potIndex: 0,
              potAmount: 100,
              winners: [baseWinner],
            },
          ],
        }}
      />
    );
    expect(screen.getByTestId("hand-result-pot-title").textContent).toBe("Pot");
    expect(screen.getByTestId("hand-result-winner-name").textContent).toBe("You");
    expect(screen.queryByText(/Main Pot/i)).toBeNull();
  });

  test("renders pot breakdown when multiple pots exist", () => {
    const cpuWinner = {
      seatIndex: 1,
      name: "CPU 2",
      hand: ["2D", "3H", "4S"],
      handLabel: "Badugi 3-card",
      ranksLabel: "2-3-4",
      activeCards: ["2D", "3H", "4S"],
      deadCards: [],
      payout: 20,
    };
    render(
      <HandResultOverlay
        visible
        summary={{
          ...baseSummary,
          potDetails: [
            {
              potIndex: 0,
              potAmount: 80,
              winners: [baseWinner],
            },
            {
              potIndex: 1,
              potAmount: 20,
              winners: [cpuWinner],
            },
          ],
        }}
      />
    );
    const potTitles = screen.getAllByTestId("hand-result-pot-title").map((node) => node.textContent);
    expect(potTitles).toEqual(["Main Pot", "Side Pot #2"]);
    expect(screen.getAllByTestId("hand-result-winner-name").map((node) => node.textContent)).toContain(
      "CPU 2",
    );
  });
});
