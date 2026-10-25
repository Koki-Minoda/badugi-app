import React, { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

import { useGameSessionState } from "../hooks/useGameSessionState.js";

let harnessApi = null;

function SessionStateHarness() {
  const sessionApi = useGameSessionState();
  harnessApi = sessionApi;

  useEffect(() => () => {
    harnessApi = null;
  }, []);

  return (
    <div>
      <div data-testid="turn-seat">{String(sessionApi.session?.turnSeat ?? "null")}</div>
      <div data-testid="phase">{String(sessionApi.session?.phase ?? "null")}</div>
    </div>
  );
}

afterEach(() => {
  harnessApi = null;
  cleanup();
});

describe("useGameSessionState snapshot sync", () => {
  it("clears the previous hand's pot when the next hand starts empty", () => {
    render(<SessionStateHarness />);

    act(() => {
      harnessApi.resetForNewHandFromSnapshot({
        handId: "old-hand",
        players: [{ name: "You", stack: 490 }],
        pots: [{ amount: 30 }],
      });
    });
    expect(harnessApi.session.pots).toEqual([{ amount: 30 }]);

    act(() => {
      harnessApi.resetForNewHandFromSnapshot({
        handId: "new-hand",
        players: [{ name: "You", stack: 480, bet: 20 }],
        pots: [],
      });
    });
    expect(harnessApi.session.pots).toEqual([]);
  });

  it("uses controller currentActor when mirroring a controller snapshot", () => {
    render(<SessionStateHarness />);

    act(() => {
      harnessApi.resetForNewHandFromSnapshot({
        handId: "d01-mobile-stale-controls-fixture",
        phase: "DRAW",
        turn: 0,
        players: [{ name: "You" }, { name: "Mina" }],
      });
    });

    expect(screen.getByTestId("turn-seat").textContent).toBe("0");

    act(() => {
      harnessApi.updateAfterActionFromSnapshot({
        handId: "d01-mobile-stale-controls-fixture",
        phase: "BET",
        currentActor: 1,
        players: [{ name: "You" }, { name: "Mina" }],
      });
    });

    expect(screen.getByTestId("phase").textContent).toBe("BET");
    expect(screen.getByTestId("turn-seat").textContent).toBe("1");
  });
});
