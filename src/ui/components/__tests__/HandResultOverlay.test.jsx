import React from "react";
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HandResultOverlay from "../HandResultOverlay.jsx";

const baseSummary = {
  handId: 1,
  pot: 100,
  winners: [
    { seatIndex: 0, name: "You", hand: ["AD", "10C"], label: "Badugi", payout: 100 },
  ],
};

describe("HandResultOverlay", () => {
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
              winners: baseSummary.winners,
            },
          ],
        }}
      />
    );
    expect(screen.queryByText(/Pot #/)).toBeNull();
    expect(screen.getByText("You")).toBeDefined();
  });

  test("renders pot breakdown when multiple pots exist", () => {
    render(
      <HandResultOverlay
        visible
        summary={{
          ...baseSummary,
          potDetails: [
            {
              potIndex: 0,
              potAmount: 80,
              winners: [baseSummary.winners[0]],
            },
            {
              potIndex: 1,
              potAmount: 20,
              winners: [
                {
                  seatIndex: 1,
                  name: "CPU 2",
                  hand: ["2D", "3H"],
                  label: "2-card",
                  payout: 20,
                },
              ],
            },
          ],
        }}
      />
    );
    const potLabels = screen.getAllByText(/Pot #/i);
    expect(potLabels.length).toBeGreaterThan(1);
    expect(screen.getByText("CPU 2")).toBeDefined();
  });
});
