import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import TournamentHUD from "../TournamentHUD.jsx";

describe("TournamentHUD", () => {
  afterEach(() => {
    cleanup();
  });

  const baseProps = {
    levelLabel: "Level 1 — 5/10 (Ante 0)",
    playersRemainingText: "Players Remaining: 18 / 18",
    tablesActiveText: "Tables: 3",
    heroPositionText: "Table 1  Seat 1",
  };

  it("shows final table badge and payout summary when supplied", () => {
    render(
      <TournamentHUD
        {...baseProps}
        payoutSummaryText="Top 3 paid"
        isFinalTable
      />,
    );
    expect(screen.getByTestId("mtt-hud-final-table")).not.toBeNull();
    expect(screen.getByTestId("mtt-hud-payout-summary").textContent).toBe("Top 3 paid");
  });

  it("omits optional labels when not in final table mode", () => {
    render(<TournamentHUD {...baseProps} />);
    expect(screen.queryByTestId("mtt-hud-final-table")).toBeNull();
    expect(screen.queryByTestId("mtt-hud-payout-summary")).toBeNull();
  });
});
