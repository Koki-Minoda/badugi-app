import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import HistoryScreen from "../HistoryScreen.jsx";

vi.mock("../../../utils/history.js", () => ({
  getHands: () => [
    {
      handId: "cash-hand-1",
      startedAt: Date.UTC(2026, 4, 4, 8, 0),
      endedAt: Date.UTC(2026, 4, 4, 8, 2),
      buttonSeat: 2,
      sbSeat: 3,
      bbSeat: 4,
      seats: [
        { seat: 0, name: "Hero", stackAfter: 620, bet: 40, action: "call" },
        { seat: 1, name: "CPU 1", stackAfter: 0, bet: 40, allIn: true, action: "all-in" },
      ],
      pots: [{ label: "Main", amount: 120, eligibleSeats: [0, 1] }],
      events: [
        { type: "HAND_START" },
        { type: "ACTION", seat: 0, action: "call" },
        { type: "SHOWDOWN" },
        { type: "HAND_END", totalPot: 120, winners: [{ seat: 0, amount: 120 }] },
      ],
    },
  ],
  getTournaments: () => [
    {
      tournamentId: "tourney-1",
      tsEnd: Date.UTC(2026, 4, 4, 9, 0),
      buyIn: 1000,
      entries: 18,
      finish: 2,
      prize: 2700,
      tier: "Store",
    },
  ],
  getTournamentHands: () => [
    {
      handId: "tourney-hand-1",
      ts: Date.UTC(2026, 4, 4, 9, 5),
      pot: 80,
      winners: ["Hero"],
      playerSummaries: [
        {
          seat: 0,
          name: "Hero",
          bet: 40,
          stackBefore: 500,
          stackAfter: 580,
          drawCount: 1,
          action: "Call",
        },
      ],
      actionLog: [{ phase: "BET", seatName: "Hero", type: "call" }],
    },
  ],
}));

describe("HistoryScreen", () => {
  afterEach(() => cleanup());

  it("shows cash hand history alongside tournament history", () => {
    render(
      <MemoryRouter>
        <HistoryScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "キャッシュゲーム履歴" })).toBeTruthy();
    expect(screen.getByText("cash-hand-1")).toBeTruthy();
    expect(screen.getAllByText(/Seat 0 \+120/).length).toBeGreaterThan(0);
    expect(screen.getByText("Action Timeline")).toBeTruthy();
    expect(screen.getByText("Pot details")).toBeTruthy();
    expect(screen.getByText("CPU 1")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "トーナメント一覧" })).toBeTruthy();
    expect(screen.getByText("tourney-1")).toBeTruthy();
    expect(screen.getByText("tourney-hand-1")).toBeTruthy();
  });
});
