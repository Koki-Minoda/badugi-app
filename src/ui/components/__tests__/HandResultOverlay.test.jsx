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

  test("renders hi/lo split winners as separate result groups", () => {
    render(
      <HandResultOverlay
        visible
        summary={{
          handId: "stud8-hand-1",
          pot: 101,
          potDetails: [
            {
              potIndex: 0,
              amount: 101,
              highWinners: [
                {
                  seatIndex: 0,
                  name: "High Seat",
                  handLabel: "Pair of Aces",
                  payout: 51,
                },
              ],
              lowWinners: [
                {
                  seatIndex: 1,
                  name: "Low Seat",
                  handLabel: "A-5 Low 7-4-3-2-A",
                  payout: 50,
                },
              ],
            },
          ],
        }}
      />
    );

    expect(screen.getByTestId("hand-result-pot-amount").textContent).toBe("¥101");
    expect(screen.getAllByTestId("hand-result-winner-group-label").map((node) => node.textContent)).toEqual([
      "High",
      "Low",
    ]);
    expect(screen.getByText("High Seat")).toBeTruthy();
    expect(screen.getByText("Low Seat")).toBeTruthy();
  });

  test("renders Badugi component and low component winners separately", () => {
    render(
      <HandResultOverlay
        visible
        summary={{
          handId: "razzdugi-hand-1",
          pot: 100,
          potDetails: [
            {
              potIndex: 0,
              amount: 100,
              badugiWinners: [
                {
                  seatIndex: 2,
                  name: "Badugi Seat",
                  handLabel: "Badugi 4-card",
                  payout: 50,
                },
              ],
              lowWinners: [
                {
                  seatIndex: 3,
                  name: "Low Seat",
                  handLabel: "A-5 Low 6-4-3-2-A",
                  payout: 50,
                },
              ],
            },
          ],
        }}
      />
    );

    expect(screen.getAllByTestId("hand-result-winner-group-label").map((node) => node.textContent)).toEqual([
      "Low",
      "Badugi",
    ]);
    expect(screen.getByText("Badugi Seat")).toBeTruthy();
    expect(screen.getByText("Low Seat")).toBeTruthy();
  });

  test("renders split draw component pot details and odd chip", () => {
    render(
      <HandResultOverlay
        visible
        summary={{
          handId: "badacey-hand-1",
          pot: 101,
          potDetails: [
            {
              potIndex: 0,
              sourcePotIndex: 0,
              component: "badugi",
              componentLabel: "Badugi half",
              potAmount: 51,
              oddChipAmount: 1,
              eligibleSeatIndexes: [0, 1],
              winners: [
                {
                  seatIndex: 0,
                  name: "Badugi Winner",
                  payout: 51,
                  handLabel: "Badugi 4-card",
                  component: "badugi",
                  componentLabel: "Badugi half",
                },
              ],
            },
            {
              potIndex: 1,
              sourcePotIndex: 0,
              component: "lowA5",
              componentLabel: "A-5 Low half",
              potAmount: 50,
              eligibleSeatIndexes: [0, 1],
              winners: [
                {
                  seatIndex: 1,
                  name: "Low Winner",
                  payout: 50,
                  handLabel: "A-5 Low 6-4-3-2-A",
                  component: "lowA5",
                  componentLabel: "A-5 Low half",
                },
              ],
            },
          ],
        }}
      />
    );

    expect(screen.getAllByTestId("hand-result-pot-title").map((node) => node.textContent)).toEqual([
      "Main Pot · Badugi half",
      "Main Pot · A-5 Low half",
    ]);
    expect(screen.getAllByTestId("hand-result-component-label").map((node) => node.textContent)).toEqual([
      "Component pot: Badugi half",
      "Component pot: A-5 Low half",
    ]);
    expect(screen.getByTestId("hand-result-odd-chip").textContent).toBe(
      "Odd chip +1 to Badugi half",
    );
    expect(screen.getAllByTestId("hand-result-winner-component").map((node) => node.textContent)).toEqual([
      "Badugi half",
      "A-5 Low half",
    ]);
  });

  test("renders Dramaha board and draw component winners with source side pot titles", () => {
    render(
      <HandResultOverlay
        visible
        summary={{
          handId: "dramaha-hand-1",
          pot: 151,
          potDetails: [
            {
              potIndex: 0,
              sourcePotIndex: 0,
              component: "board",
              componentLabel: "Board half",
              potAmount: 50,
              winners: [{ seatIndex: 0, name: "Board Seat", payout: 50, handLabel: "Full House" }],
            },
            {
              potIndex: 1,
              sourcePotIndex: 0,
              component: "draw",
              componentLabel: "Draw half",
              potAmount: 51,
              oddChipAmount: 1,
              winners: [{ seatIndex: 1, name: "Draw Seat", payout: 51, handLabel: "Ace-high flush" }],
            },
            {
              potIndex: 2,
              sourcePotIndex: 1,
              component: "board",
              componentLabel: "Board half",
              potAmount: 25,
              winners: [{ seatIndex: 2, name: "Side Board", payout: 25, handLabel: "Trips" }],
            },
          ],
        }}
      />
    );

    expect(screen.getAllByTestId("hand-result-pot-title").map((node) => node.textContent)).toEqual([
      "Main Pot · High / Board half",
      "Main Pot · Draw half",
      "Side Pot · High / Board half",
    ]);
    const potSections = screen.getAllByTestId("hand-result-pot");
    expect(potSections[0].getAttribute("data-component")).toBe("board");
    expect(potSections[1].getAttribute("data-component")).toBe("draw");
    expect(screen.getAllByTestId("hand-result-component-label").map((node) => node.textContent)).toEqual([
      "Component pot: High / Board half",
      "Component pot: Draw half",
      "Component pot: High / Board half",
    ]);
    expect(screen.getByTestId("hand-result-odd-chip").textContent).toBe(
      "Odd chip +1 to Draw half",
    );
    expect(screen.getByText("Board Seat")).toBeTruthy();
    expect(screen.getByText("Draw Seat")).toBeTruthy();
    expect(screen.getByText("Side Board")).toBeTruthy();
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
