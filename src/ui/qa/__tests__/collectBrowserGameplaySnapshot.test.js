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
  it("reports a result phase together with the terminal actor behind the overlay", () => {
    installSettledTournamentSnapshot();
    document.body.innerHTML = '<div>Hand Result</div><button>Next hand</button>';
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
