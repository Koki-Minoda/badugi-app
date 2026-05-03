import { describe, it, expect } from "vitest";
import { computeSeatStats, normalizeActionType } from "../stats.js";

describe("normalizeActionType", () => {
  it("normalizes action labels", () => {
    expect(normalizeActionType("Raise (All-in)")).toBe("raise");
    expect(normalizeActionType("Call")).toBe("call");
    expect(normalizeActionType("Fold")).toBe("fold");
    expect(normalizeActionType("DRAW(2)")).toBe("draw");
  });
});

describe("computeSeatStats", () => {
  it("computes VPIP/PFR/AF/Hands per player", () => {
    const actionLog = [
      {
        handId: "h1",
        playerId: "cpu-1",
        seat: 1,
        phase: "BET",
        round: 0,
        action: "Small Blind",
        betBefore: 0,
        betAfter: 5,
        isForced: true,
      },
      {
        handId: "h1",
        playerId: "cpu-1",
        seat: 1,
        phase: "BET",
        round: 0,
        action: "Call",
        stackBefore: 100,
        stackAfter: 90,
      },
      {
        handId: "h2",
        playerId: "cpu-1",
        seat: 1,
        phase: "BET",
        round: 0,
        action: "Fold",
        betBefore: 0,
        betAfter: 0,
      },
      {
        handId: "h2",
        playerId: "cpu-1",
        seat: 1,
        phase: "BET",
        round: 1,
        action: "Call",
        stackBefore: 80,
        stackAfter: 70,
      },
    ];

    const stats = computeSeatStats(actionLog, { keyBy: "playerId" });
    const s = stats["cpu-1"];
    expect(s.hands).toBe(2);
    expect(s.vpip).toBe(1);
    expect(s.pfr).toBe(0);
    expect(s.vpipRate).toBeCloseTo(0.5);
    expect(s.pfrRate).toBeCloseTo(0);
    expect(s.af).toBeCloseTo(0); // 0 aggressive, 2 calls
  });

  it("computes HUD rates for ATS, 3BET, and street actions when log context exists", () => {
    const actionLog = [
      {
        handId: "h1",
        playerId: "cpu-hud",
        phase: "BET",
        round: 0,
        action: "Raise",
        paid: 20,
        positionLabel: "BTN",
        raiseCountTable: 1,
      },
      {
        handId: "h2",
        playerId: "cpu-hud",
        phase: "BET",
        round: 0,
        action: "Raise",
        paid: 30,
        positionLabel: "BTN",
        raiseCountTable: 2,
      },
      {
        handId: "h2",
        playerId: "cpu-hud",
        phase: "BET",
        round: 1,
        action: "Bet",
        paid: 10,
      },
      {
        handId: "h2",
        playerId: "cpu-hud",
        phase: "BET",
        round: 2,
        action: "Call",
        paid: 10,
      },
      {
        handId: "h2",
        playerId: "cpu-hud",
        phase: "BET",
        round: 3,
        action: "Bet",
        paid: 20,
      },
    ];
    const stats = computeSeatStats(actionLog, { keyBy: "playerId" });
    const s = stats["cpu-hud"];
    expect(s.atsRate).toBeCloseTo(1);
    expect(s.threeBetRate).toBeCloseTo(0.5);
    expect(s.street.flop.cb).toBeCloseTo(1);
    expect(s.street.turn.ccb).toBeCloseTo(1);
    expect(s.street.river.taf).toBeCloseTo(1);
  });

  it("prefers stack delta for paid over bet delta", () => {
    const actionLog = [
      {
        handId: "h3",
        playerId: "cpu-2",
        seat: 2,
        phase: "BET",
        round: 0,
        action: "Call",
        stackBefore: 100,
        stackAfter: 100,
        betBefore: 0,
        betAfter: 10,
      },
    ];
    const stats = computeSeatStats(actionLog, { keyBy: "playerId" });
    const s = stats["cpu-2"];
    expect(s.hands).toBe(1);
    expect(s.vpip).toBe(0);
    expect(s.pfr).toBe(0);
  });
});
