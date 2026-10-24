import { describe, expect, it, vi } from "vitest";
import { resolveEffectiveControllerSnapshot, syncTournamentBadugiSession } from "../controllerSnapshotResolver.js";

const matchesVariant = (snapshot, variantId) => snapshot?.variantId === variantId;

describe("resolveEffectiveControllerSnapshot", () => {
  it("prefers a live, matching session snapshot", () => {
    const session = { phase: "BET", variantId: "D01", marker: "session" };
    expect(resolveEffectiveControllerSnapshot({
      sessionController: { getUiSnapshot: () => session },
      sessionState: {},
      candidates: [{ phase: "BET", variantId: "D01", marker: "fallback" }],
      variantId: "D01",
      matchesVariant,
    })).toBe(session);
  });

  it("skips idle, mismatched, and failed session snapshots in candidate order", () => {
    const warn = vi.fn();
    const matching = { phase: "DRAW", variantId: "D02" };
    expect(resolveEffectiveControllerSnapshot({
      sessionController: { getUiSnapshot: () => { throw new Error("stale"); } },
      sessionState: {},
      candidates: [null, { phase: "BET", variantId: "D01" }, matching],
      variantId: "D02",
      matchesVariant,
      warn,
    })).toBe(matching);
    expect(warn).toHaveBeenCalledOnce();
  });
});


it("keeps Badugi MTT session aligned after a legacy CPU action and street reset", () => {
  const controller = { syncFromExternalState: vi.fn(input => ({...input, synced: true})) };
  const state = { context: { marker: "hand" }, handIndex: 4 };
  const next = syncTournamentBadugiSession({ controller, state, snapshot: { players: [{ stack: 450 }], currentBet: 10, currentActor: 3, turn: 2, metadata: { currentBet: 50, actingPlayerIndex: 2 } }, phase: "BET", drawRound: 0, handId: "table-hand" });
  expect(next).toMatchObject({ handIndex: 4, context: state.context, snapshot: { handId: "table-hand", phase: "BET", drawRound: 0, currentBet: 50, currentActor: 2, turn: 2, nextTurn: 2 } });
  const draw = syncTournamentBadugiSession({ controller, state: next, snapshot: { phase: "DRAW", drawRound: 1, metadata: { currentBet: 0, actingPlayerIndex: 1 } }, phase: "BET", drawRound: 0, handId: "table-hand" });
  expect(draw.snapshot).toMatchObject({ phase: "DRAW", drawRound: 1, currentBet: 0, currentActor: 1 });
});
