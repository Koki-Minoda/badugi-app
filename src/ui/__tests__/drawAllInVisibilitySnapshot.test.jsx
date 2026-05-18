import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Player from "../components/Player.jsx";
import { BadugiUIAdapter } from "../game/badugi/BadugiUIAdapter.js";
import { DrawLowballUIAdapter } from "../game/draw/DrawLowballUIAdapter.js";

const drawPlayer = {
  name: "All-in CPU",
  stack: 0,
  betThisRound: 40,
  totalInvested: 40,
  allIn: true,
  folded: false,
  hand: ["AS", "2D", "3H", "4C", "5S"],
  showHand: true,
};

function renderOpponentSeat(player, phase = "DRAW") {
  render(
    <Player
      player={player}
      index={1}
      selfIndex={0}
      turn={1}
      dealerIdx={0}
      phase={phase}
      positionLabel="BB"
      displayVariant="badugi"
    />,
  );
}

describe("draw all-in visibility snapshots", () => {
  afterEach(() => cleanup());

  it("hides non-hero all-in draw cards before showdown even if stale showHand is true", () => {
    const adapter = new BadugiUIAdapter();
    const props = adapter.buildViewProps({
      controllerSnapshot: {
        variantId: "badugi",
        phase: "DRAW",
        turn: 1,
        players: [
          { name: "Hero", stack: 500, hand: ["KH", "QD", "JC", "9S"] },
          drawPlayer,
        ],
        pots: [{ amount: 80, eligible: [0, 1] }],
      },
      tableConfig: { bbValue: 20, maxDraws: 3 },
    });

    expect(props.seatViews[1].showHand).toBe(false);
    renderOpponentSeat(props.seatViews[1], "DRAW");
    expect(screen.getByTestId("player-1-card-0").textContent).not.toContain("A");
  });

  it("reveals non-folded all-in draw cards at showdown", () => {
    const adapter = new DrawLowballUIAdapter();
    const props = adapter.buildViewProps({
      controllerSnapshot: {
        variantId: "D01",
        phase: "SHOWDOWN",
        turn: null,
        players: [
          { name: "Hero", stack: 500, hand: ["KH", "QD", "JC", "9S", "8H"] },
          drawPlayer,
        ],
        pots: [{ amount: 80, eligible: [0, 1] }],
      },
      tableConfig: { bbValue: 20, maxDraws: 3 },
    });

    expect(props.seatViews[1].showHand).toBe(true);
    renderOpponentSeat(props.seatViews[1], "SHOWDOWN");
    expect(screen.getByTestId("player-1-card-0").textContent).toContain("A♠");
  });

  it("keeps folded all-in hands hidden at showdown", () => {
    const adapter = new DrawLowballUIAdapter();
    const props = adapter.buildViewProps({
      controllerSnapshot: {
        variantId: "S02",
        phase: "SHOWDOWN",
        turn: null,
        players: [
          { name: "Hero", stack: 500, hand: ["KH", "QD", "JC", "9S", "8H"] },
          { ...drawPlayer, folded: true, hasFolded: true },
        ],
        pots: [{ amount: 80, eligible: [0] }],
      },
      tableConfig: { bbValue: 20, maxDraws: 1 },
    });

    expect(props.seatViews[1].showHand).toBe(false);
  });
});
