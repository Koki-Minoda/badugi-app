import { describe, expect, it } from "vitest";
import { resolveControllerDrawHistory } from "../controllerDrawHistory.js";

describe("resolveControllerDrawHistory", () => {
  it("keeps the submitted final draw and pre-settlement player snapshot", () => {
    const otherBefore = {
      seat: 0,
      stack: 0,
      allIn: true,
      folded: false,
      hand: ["3S", "4H", "5D"],
      totalInvested: 200,
    };
    const otherSettled = {
      ...otherBefore,
      allIn: false,
      folded: true,
      hand: [],
      totalInvested: 0,
    };
    const before = { seat: 3, stack: 0, allIn: true, hand: ["AS", "2H", "8D"] };
    const afterDraw = {
      ...before,
      hand: ["AS", "2H", "4C"],
      lastAction: "DRAW(1)",
    };
    const settledOut = {
      seat: 3,
      stack: 0,
      allIn: false,
      folded: true,
      hand: [],
      lastAction: "Out",
    };

    const resolved = resolveControllerDrawHistory({
      outcome: {
        actionSnapshot: { players: [otherSettled, null, null, afterDraw] },
        snapshot: { players: [null, null, null, settledOut] },
      },
      seat: 3,
      playerBefore: before,
      playersBefore: [otherBefore, null, null, before],
      payload: { discardIndexes: [2] },
    });

    expect(resolved.actionLabel).toBe("DRAW(1)");
    expect(resolved.drawIndexes).toEqual([2]);
    expect(resolved.actorAfter).toEqual(afterDraw);
    expect(resolved.actionPlayers[0]).toEqual(otherBefore);
    expect(resolved.actionPlayers[3]).toEqual(afterDraw);
  });

  it("falls back to the returned snapshot and records a zero-card draw as Pat", () => {
    const player = { seat: 1, stack: 200, hand: ["AS", "2H"] };
    const resolved = resolveControllerDrawHistory({
      outcome: { snapshot: { players: [null, player] } },
      seat: 1,
      playerBefore: player,
      payload: { drawIndexes: [] },
    });

    expect(resolved.actionLabel).toBe("Pat");
    expect(resolved.actorAfter).toEqual(player);
  });
});
