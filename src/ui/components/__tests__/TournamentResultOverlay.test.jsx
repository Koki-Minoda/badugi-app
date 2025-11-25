import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import TournamentResultOverlay from "../TournamentResultOverlay.jsx";

const basePlacements = [
  { id: "p1", place: 2, name: "CPU 2", stack: 420, payout: 300 },
  { id: "p2", place: 1, name: "Hero", stack: 1200, payout: 500 },
  { id: "p3", place: 3, name: "CPU 3", stack: 210, payout: 200 },
];

describe("TournamentResultOverlay", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders final placements in ascending order", () => {
    render(
      <TournamentResultOverlay
        visible
        placements={basePlacements}
        title="Store Tournament"
        onBackToMenu={() => {}}
      />,
    );
    const placeCells = screen
      .getAllByTestId("mtt-result-place")
      .slice(0, basePlacements.length)
      .map((node) => node.textContent);
    expect(placeCells).toEqual(["1", "2", "3"]);
    const payoutCells = screen
      .getAllByTestId("mtt-result-payout")
      .slice(0, basePlacements.length)
      .map((node) => node.textContent);
    expect(payoutCells).toEqual(["Payout 500", "Payout 300", "Payout 200"]);
    const nameCells = screen
      .getAllByTestId("mtt-result-name")
      .slice(0, basePlacements.length)
      .map((node) => node.textContent);
    expect(nameCells).toEqual(["Hero", "CPU 2", "CPU 3"]);
  });

  it("highlights the champion row", () => {
    render(
      <TournamentResultOverlay
        visible
        placements={basePlacements}
        onBackToMenu={() => {}}
      />,
    );
    const championLabels = screen
      .getAllByTestId("mtt-result-champion")
      .map((node) => node.textContent);
    expect(championLabels[0]).toContain("Hero");
    const badgeText = screen
      .getAllByTestId("mtt-result-champion-badge")
      .map((node) => node.textContent);
    expect(badgeText[0]).toBe("Champion");
  });

  it("renders payout column even when all payouts are zero", () => {
    const zeroPayoutPlacements = basePlacements.map((entry) => ({
      ...entry,
      payout: 0,
    }));
    render(
      <TournamentResultOverlay
        visible
        placements={zeroPayoutPlacements}
        onBackToMenu={() => {}}
      />,
    );
    const payoutCells = screen.getAllByTestId("mtt-result-payout").map((node) => node.textContent);
    expect(payoutCells).toEqual(["Payout 0", "Payout 0", "Payout 0"]);
  });
});
