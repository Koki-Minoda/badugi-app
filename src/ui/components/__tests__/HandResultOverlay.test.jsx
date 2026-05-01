import React from "react";
import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
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
    expect(potTitles).toEqual(["Main Pot", "Side Pot"]);
    expect(screen.getAllByTestId("hand-result-winner-name").map((node) => node.textContent)).toContain(
      "CPU 2",
    );
  });

  test("labels three side pots in a way players can distinguish", () => {
    const makeWinner = (seatIndex, name, payout) => ({
      seatIndex,
      name,
      hand: ["AD", "4C", "7H", "KS"],
      handLabel: "Badugi 4-card",
      payout,
    });

    render(
      <HandResultOverlay
        visible
        summary={{
          handId: "multi-side",
          pot: 1100,
          potDetails: [
            { potIndex: 0, potAmount: 400, winners: [makeWinner(2, "CPU 3", 400)] },
            { potIndex: 1, potAmount: 300, winners: [makeWinner(2, "CPU 3", 300)] },
            { potIndex: 2, potAmount: 200, winners: [makeWinner(2, "CPU 3", 200)] },
            { potIndex: 3, potAmount: 200, winners: [makeWinner(3, "CPU 4", 200)] },
          ],
        }}
      />
    );

    expect(screen.getAllByTestId("hand-result-pot-title").map((node) => node.textContent)).toEqual([
      "Main Pot",
      "Side Pot",
      "Side Pot 2",
      "Side Pot 3",
    ]);
    const sections = screen.getAllByTestId("hand-result-pot");
    expect(sections[0].textContent).toContain("CPU 3");
    expect(sections[1].textContent).toContain("CPU 3");
    expect(sections[2].textContent).toContain("CPU 3");
    expect(sections[3].textContent).toContain("CPU 4");
  });

  test("renders 2-7 low hand labels for draw variants", () => {
    render(
      <HandResultOverlay
        visible
        summary={{
          handId: "d01-hand-1",
          pot: 100,
          winners: [
            {
              seatIndex: 0,
              name: "You",
              handLabel: "2-7 Low 7-5-4-3-2",
              payout: 100,
            },
          ],
        }}
      />
    );

    expect(screen.getByTestId("hand-result-winner-hand-label").textContent).toBe(
      "2-7 Low 7-5-4-3-2",
    );
  });

  test("opens follow-up replay targets from the result overlay", () => {
    const onReplayTarget = vi.fn();
    const replayTarget = { handId: "hand-1", actionSeq: 4, seat: 0 };
    render(
      <HandResultOverlay
        visible
        summary={{
          ...baseSummary,
          followUpSummary: {
            issueCount: 1,
            topIssue: {
              type: "weak_call",
              seat: 0,
              street: "BET",
              detail: "Called with a weak hand.",
            },
            replayTarget,
          },
        }}
        onReplayTarget={onReplayTarget}
      />,
    );

    expect(screen.getByTestId("hand-result-follow-up").textContent).toContain("weak_call");
    fireEvent.click(screen.getByTestId("hand-result-follow-up-replay"));
    expect(onReplayTarget).toHaveBeenCalledWith(replayTarget);
  });
});
