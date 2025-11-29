import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import TournamentHUD from "../TournamentHUD.jsx";

describe("TournamentHUD", () => {
  afterEach(() => {
    cleanup();
  });

  const baseProps = {
    tournamentName: "Store Tournament",
    prizePoolTotal: 54000,
    payoutBreakdown: [
      { place: 1, percent: 50, amount: 27000 },
      { place: 2, percent: 30, amount: 16200 },
      { place: 3, percent: 20, amount: 10800 },
    ],
    playersRemaining: 18,
    totalEntrants: 18,
    averageStack: 3000,
    currentLevelNumber: 1,
    levelLabel: "Level 1  5/10 (Ante 0)",
    currentBlinds: { sb: 5, bb: 10, ante: 0 },
    nextLevelBlinds: { sb: 10, bb: 20, ante: 1 },
    handsPlayedThisLevel: 0,
    handsThisLevel: 5,
    nextBreakLabel: "--:--",
    currentVariantLabel: "Badugi",
    nextVariantLabel: "NLH",
  };

  it("renders prize pool and payout details", () => {
    render(<TournamentHUD {...baseProps} />);
    expect(screen.getByTestId("tournament-hud")).toBeTruthy();
    expect(screen.getByText("Store Tournament")).toBeTruthy();
    expect(screen.getByText("27,000")).toBeTruthy();
    expect(screen.getByText(/50%/)).toBeTruthy();
  });

  it("shows hands progress, blinds, ante, and next level info", () => {
    render(<TournamentHUD {...baseProps} />);
    expect(screen.getByText("0 / 5")).toBeTruthy();
    expect(screen.getByText("5 / 10")).toBeTruthy();
    expect(screen.getByText("Ante 0")).toBeTruthy();
    expect(screen.getByText("10 / 20 (Ante 1)")).toBeTruthy();
  });

  it("displays average stack, players, and variant metadata", () => {
    render(<TournamentHUD {...baseProps} />);
    expect(screen.getByText("3,000")).toBeTruthy();
    expect(screen.getByText("18 / 18")).toBeTruthy();
    expect(screen.getByText("Badugi")).toBeTruthy();
    expect(screen.getByText(/Next: NLH/)).toBeTruthy();
  });
});
