import { describe, expect, it } from "vitest";
import { DrawLowballUIAdapter } from "../game/draw/DrawLowballUIAdapter.js";
import { buildBlindPostingAudit } from "../qa/blindPostingAudit.js";

const players = [
  {
    name: "Hero",
    stack: 580,
    betThisRound: 20,
    bet: 20,
    totalInvested: 20,
    hand: ["7S", "5D", "4C", "3H", "2S"],
  },
  { name: "CPU 2", stack: 600, betThisRound: 0, totalInvested: 0, hand: [] },
  { name: "CPU 3", stack: 600, betThisRound: 0, totalInvested: 0, hand: [] },
  { name: "CPU 4", stack: 600, betThisRound: 0, totalInvested: 0, hand: [] },
  { name: "CPU 5", stack: 600, betThisRound: 0, totalInvested: 0, hand: [] },
  {
    name: "CPU 6",
    stack: 590,
    betThisRound: 10,
    bet: 10,
    totalInvested: 10,
    hand: [],
  },
];

describe("D01 blind posting UI snapshot", () => {
  it("uses controller dealerIndex for position badges and blind seats", () => {
    const snapshot = {
      variantId: "D01",
      phase: "BET",
      dealerIndex: 4,
      currentBet: 20,
      turn: 1,
      nextTurn: 1,
      players,
      metadata: {
        lastBlinds: { sbIndex: 5, bbIndex: 0 },
        currentBet: 20,
      },
    };
    const adapter = new DrawLowballUIAdapter();
    const props = adapter.buildViewProps({
      controllerSnapshot: snapshot,
      tableConfig: { sbValue: 10, bbValue: 20, anteValue: 0, maxDraws: 3 },
    });

    expect(props.seatViews[0]).toMatchObject({
      label: "BB",
      isBB: true,
      betThisRound: 20,
      totalInvested: 20,
    });
    expect(props.seatViews[5]).toMatchObject({
      label: "SB",
      isSB: true,
      betThisRound: 10,
      totalInvested: 10,
    });
    expect(props.potView.total).toBe(30);
    expect(props.controlsConfig.needsToCall).toBe(false);
  });

  it("exports expected vs actual blind posts for mobile QA", () => {
    const audit = buildBlindPostingAudit({
      snapshot: {
        variantId: "D01",
        dealerIndex: 4,
        currentBet: 20,
        smallBlind: 10,
        bigBlind: 20,
        metadata: { lastBlinds: { sbIndex: 5, bbIndex: 0 } },
      },
      players,
      heroSeat: 0,
      displayedBetBySeat: { 0: 20, 5: 10 },
      displayedPot: 30,
    });

    expect(audit.heroPositionLabel).toBe("BB");
    expect(audit.expectedBlindPosts).toEqual([
      { seat: 5, type: "SB", amount: 10 },
      { seat: 0, type: "BB", amount: 20 },
    ]);
    expect(audit.actualInvestedBySeat["0"]).toBe(20);
    expect(audit.displayedBetBySeat["0"]).toBe(20);
    expect(audit.heroToCall).toBe(0);
    expect(audit.pot).toBe(30);
  });
});
