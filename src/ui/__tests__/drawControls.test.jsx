import React, { useState } from "react";
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import Player from "../components/Player.jsx";
import Controls from "../components/Controls.jsx";

afterEach(() => {
  cleanup();
});

function HeroDrawHarness({
  heroHasDrawn = false,
  heroAllIn = false,
  heroEligible = true,
  controllerTurn = 0,
  hand = ["AS", "KD", "QC", "JH"],
}) {
  const [players, setPlayers] = useState([
    {
      name: "You",
      hand,
      stack: 500,
      betThisRound: 0,
      showHand: true,
      hasDrawn: heroHasDrawn,
      allIn: heroAllIn,
      folded: !heroEligible,
    },
  ]);
  const [selection, setSelection] = useState([]);
  const [lastDraw, setLastDraw] = useState(null);

  const heroSeatIndex = 0;
  const controlsPhase = "DRAW";
  const heroCanAct = heroEligible && controllerTurn === heroSeatIndex;
  const heroDrawAllowedByEngine =
    controlsPhase === "DRAW" && heroEligible && !heroHasDrawn && !heroAllIn;
  const heroCanDraw = heroCanAct && heroDrawAllowedByEngine;

  const handleCardClick = (cardIdx) => {
    if (!heroCanDraw) return;
    setSelection((prev) => {
      if (prev.includes(cardIdx)) {
        return prev.filter((idx) => idx !== cardIdx);
      }
      if (prev.length >= 4) return prev;
      return [...prev, cardIdx];
    });
  };

  const handleDraw = () => {
    const drawCount = selection.length;
    const replacedCards = selection.map((index) => ({ index }));
    setLastDraw({ drawCount, replacedCards });
    setSelection([]);
    if (drawCount > 0) {
      setPlayers((prev) =>
        prev.map((p, idx) =>
          idx === 0
            ? {
                ...p,
                hasDrawn: true,
              }
            : p
        )
      );
    }
  };

  return (
    <div>
      <Player
        player={{ ...players[0], selected: selection }}
        index={0}
        selfIndex={0}
        phase="DRAW"
        turn={controllerTurn}
        dealerIdx={0}
        onCardClick={handleCardClick}
        canSelectForDraw={heroCanDraw}
      />
      <Controls phase="DRAW" player={players[0]} onDraw={handleDraw} canDraw={heroCanDraw} />
      <div data-testid="selection">{selection.join(",")}</div>
      <div data-testid="draw-result">{lastDraw ? JSON.stringify(lastDraw) : ""}</div>
    </div>
  );
}

describe("Hero draw controls follow engine snapshot", () => {
  it("allows zero-card draw when hero has not drawn and is not all-in", () => {
    render(<HeroDrawHarness heroHasDrawn={false} heroAllIn={false} />);
    const button = screen.getByRole("button", { name: /draw selected/i });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(screen.getByTestId("draw-result").textContent).toContain('"drawCount":0');
  });

  it("tracks selections up to four cards and reports metadata", () => {
    render(<HeroDrawHarness />);
    const selection = screen.getByTestId("selection");
    const clickCard = (idx) => fireEvent.click(screen.getByTestId(`player-0-card-${idx}`));

    clickCard(0);
    clickCard(1);
    expect(selection.textContent).toBe("0,1");

    clickCard(2);
    clickCard(3);
    expect(selection.textContent).toBe("0,1,2,3");

    fireEvent.click(screen.getByRole("button", { name: /draw selected/i }));
    const result = JSON.parse(screen.getByTestId("draw-result").textContent);
    expect(result.drawCount).toBe(4);
    expect(result.replacedCards).toHaveLength(4);
    expect(screen.getByTestId("selection").textContent).toBe("");
  });

  it("caps selection at four cards even if more choices are clicked", () => {
    render(<HeroDrawHarness hand={["AS", "KD", "QC", "JH", "9C"]} />);
    const selection = screen.getByTestId("selection");
    const click = (idx) => fireEvent.click(screen.getByTestId(`player-0-card-${idx}`));
    click(0);
    click(1);
    click(2);
    click(3);
    click(4);
    expect(selection.textContent).toBe("0,1,2,3");
  });

  it("disables draw when hero already drew according to engine state", () => {
    render(<HeroDrawHarness heroHasDrawn />);
    const button = screen.getByRole("button", { name: /draw selected/i });
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByTestId("player-0-card-0"));
    expect(screen.getByTestId("selection").textContent).toBe("");
  });

  it("disables draw when hero is all-in even if previous adapter flag allowed drawing", () => {
    render(<HeroDrawHarness heroAllIn />);
    const button = screen.getByRole("button", { name: /draw selected/i });
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByTestId("player-0-card-1"));
    expect(screen.getByTestId("selection").textContent).toBe("");
  });
});
