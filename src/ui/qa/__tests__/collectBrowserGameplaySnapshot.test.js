import { afterEach, describe, expect, it } from "vitest";
import { collectBrowserGameplaySnapshot } from "../collectBrowserGameplaySnapshot.js";
import { assertBrowserGameplayInvariants } from "../assertBrowserGameplayInvariants.js";

function installSettledTournamentSnapshot() {
  // Weekly WebKit trace: the result overlay is open while the legacy table
  // has already cleared wagers/cards and prepared its next BET state.
  const snapshot = {
    variantId: "badugi", handId: "settled-hand", phase: "BET",
    currentActor: 0, nextTurn: 0, drawRound: 1, betRound: 1,
    dealerIdx: 5, currentBet: 0, pot: 0,
    players: Array.from({ length: 6 }, (_, seat) => ({
      seat, stack: 5000, hand: [], betThisRound: 0, hasActedThisRound: false,
    })),
  };
  window.__BADUGI_E2E__ = {
    getStateSnapshot: () => ({ gameVariant: "badugi", phase: "BET", turn: 0, controllerSnapshot: snapshot }),
    getPhaseState: () => ({ phase: "HAND_RESULT", turn: null, drawRound: 1, betRound: 1 }),
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  delete window.__BADUGI_E2E__;
  delete window.__MGX_GAMEPLAY_TRACE__;
  delete window.__MGX_SNAPSHOT_MERGE_SOURCE_TRACE__;
});

describe("browser gameplay result snapshot", () => {
  it("uses the live hand and total pot when the controller snapshot still carries an old hand", () => {
    window.__BADUGI_E2E__ = {
      getStateSnapshot: () => ({
        gameVariant: "badugi", handId: "hand-2", potTotal: 70, phase: "BET",
        controllerSnapshot: {
          variantId: "badugi", handId: "hand-1", phase: "BET", currentActor: 1,
          pot: 30, players: [{ betThisRound: 20 }, { betThisRound: 20 }],
        },
      }),
      getPhaseState: () => ({ phase: "BET", turn: 1 }),
    };
    document.body.innerHTML = '<div data-testid="table-total-pot">POT 70</div><div data-testid="table-phase-badge">BET | D1 | R1</div>';
    const row = collectBrowserGameplaySnapshot({ mode: "cash" });
    expect(row.handId).toBe("hand-2");
    expect(row.controller.pot).toBe(70);
    expect(assertBrowserGameplayInvariants(row).violations.filter((v) => v.type === "POT")).toEqual([]);
  });

  it("falls back to the controller pot when the live state does not expose a total", () => {
    window.__BADUGI_E2E__ = {
      getStateSnapshot: () => ({
        gameVariant: "badugi", handId: "hand-1", phase: "BET",
        controllerSnapshot: { handId: "hand-1", phase: "BET", pot: 85, players: [] },
      }),
      getPhaseState: () => ({ phase: "BET" }),
    };
    document.body.innerHTML = '<div data-testid="table-total-pot">POT 85</div>';
    expect(collectBrowserGameplaySnapshot().controller.pot).toBe(85);
  });

  it("checks the visible result pot after the background table has reset", () => {
    installSettledTournamentSnapshot();
    window.__BADUGI_E2E__.getPhaseState = () => ({ phase: "HAND_RESULT", resultPot: 120, turn: null });
    document.body.innerHTML = '<div data-testid="table-total-pot">POT0</div><div data-testid="hand-result-pot"><span data-testid="hand-result-pot-title">ポット 1</span><span>120 チップ</span></div><h2 data-testid="hand-result-total">ポット 120 チップ</h2>';
    const resultPot = document.querySelector('[data-testid="hand-result-pot"]');
    resultPot.getBoundingClientRect = () => ({ width: 200, height: 40, top: 0, left: 0, right: 200, bottom: 40 });
    const total = document.querySelector('[data-testid="hand-result-total"]');
    total.getBoundingClientRect = () => ({ width: 200, height: 40, top: 0, left: 0, right: 200, bottom: 40 });
    const row = collectBrowserGameplaySnapshot();
    row.controller.players.forEach((player) => { player.totalInvested = 20; });
    expect(row.ui.displayedPot).toBe(120);
    expect(row.controller.resultPot).toBe(120);
    expect(row.ui.resultVisible).toBe(true);
    expect(assertBrowserGameplayInvariants(row).violations.filter((v) => v.type === "POT")).toEqual([]);
  });

  it.each([["Hand Result", "Next hand"], ["ハンドの結果", "次のハンドへ"]])("reports a result phase with the terminal actor behind %s", (title, next) => {
    installSettledTournamentSnapshot();
    document.body.innerHTML = `<div>${title}</div><button>${next}</button>`;
    const row = collectBrowserGameplaySnapshot({ mode: "tournament" });

    expect(row.phase).toBe("HAND_RESULT");
    expect(row.controller.actorSeat).toBeNull();
    expect(row.mergeSource.controller.phase).toBe("BET");
    expect(assertBrowserGameplayInvariants(row).violations.filter((v) => v.severity === "P0")).toEqual([]);

    // The same raw state must remain actionable once the overlay closes.
    document.body.innerHTML = "";
    const active = collectBrowserGameplaySnapshot();
    expect(active.phase).toBe("BET");
    expect(active.controller.actorSeat).toBe(0);
  });

  it("still rejects actionable controls exposed on a terminal result", () => {
    installSettledTournamentSnapshot();
    document.body.innerHTML = '<div>Hand Result</div>';
    const row = collectBrowserGameplaySnapshot();
    row.ui.heroControlsVisible = true;
    expect(assertBrowserGameplayInvariants(row).violations).toContainEqual(
      expect.objectContaining({ type: "TERMINAL", severity: "P0", message: "terminal state still shows hero controls" }),
    );
  });
});
