import { describe, expect, it, vi } from "vitest";
import { resolveEffectiveControllerSnapshot } from "../controllerSnapshotResolver.js";

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
