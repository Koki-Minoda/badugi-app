import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import TableSummaryPanel from "../TableSummaryPanel.jsx";

function renderPanel(phaseTag) {
  return render(
    <TableSummaryPanel
      phaseTag={phaseTag}
      totalPot={70}
      drawRound={1}
      maxDraws={3}
      betRoundIndex={0}
    />,
  );
}

describe("TableSummaryPanel phase accent", () => {
  afterEach(cleanup);

  it.each(["DRAW", "draw", "DRAWING"])("shows the draw rusher accent for %s", (phaseTag) => {
    renderPanel(phaseTag);
    expect(screen.getByText(/draw rusher/i)).toBeTruthy();
    expect(screen.getByTestId("table-summary-panel").className).toContain("red");
  });

  it.each(["BET", "SHOWDOWN", "WAITING"])("does not leave draw rusher visible for %s", (phaseTag) => {
    renderPanel(phaseTag);
    expect(screen.queryByText(/draw rusher/i)).toBeNull();
    expect(screen.getByTestId("table-summary-panel").className).not.toContain("red");
  });
});
