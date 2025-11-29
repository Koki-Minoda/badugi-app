import { describe, it, expect } from "vitest";
import { NLHUIAdapter } from "../NLHUIAdapter.js";

function buildSnapshot(overrides = {}) {
  return {
    street: "PREFLOP",
    dealerIndex: 2,
    smallBlindIndex: 0,
    bigBlindIndex: 1,
    currentActor: 0,
    currentBet: 20,
    boardCards: [],
    players: [
      {
        seatIndex: 0,
        name: "Hero",
        stack: 980,
        betThisStreet: 20,
        totalInvested: 20,
        holeCards: ["AS", "KS"],
        folded: false,
      },
      {
        seatIndex: 1,
        name: "CPU 1",
        stack: 990,
        betThisStreet: 20,
        totalInvested: 20,
        holeCards: ["QD", "JC"],
        folded: false,
      },
      {
        seatIndex: 2,
        name: "CPU 2",
        stack: 1000,
        betThisStreet: 0,
        totalInvested: 0,
        holeCards: ["9H", "9D"],
        folded: false,
      },
    ],
    ...overrides,
  };
}

const tableConfig = {
  blinds: { sb: 10, bb: 20, ante: 0 },
};

describe("NLHUIAdapter", () => {
  it("builds seat views and controls", () => {
    const adapter = new NLHUIAdapter();
    const snapshot = buildSnapshot();
    const view = adapter.buildViewProps({ controllerSnapshot: snapshot, tableConfig });
    expect(view.seatViews).toHaveLength(3);
    const heroSeat = view.seatViews[0];
    expect(heroSeat.isHero).toBe(true);
    expect(heroSeat.cards).toEqual(["AS", "KS"]);
    const sbSeat = view.seatViews[0];
    expect(sbSeat.isSB).toBe(true);
    const bbSeat = view.seatViews[1];
    expect(bbSeat.isBB).toBe(true);
    expect(view.controlsConfig.isHeroTurn).toBe(true);
    expect(view.controlsConfig.canFold).toBe(false);
    expect(view.hudInfo.streetLabel).toBe("Preflop");
  });

  it("formats street labels", () => {
    const adapter = new NLHUIAdapter();
    expect(adapter.formatStreetLabel("PREFLOP")).toBe("Preflop");
    expect(adapter.formatStreetLabel("TURN")).toBe("Turn");
    expect(adapter.formatStreetLabel("SHOWDOWN")).toBe("Showdown");
  });

  it("returns available actions", () => {
    const adapter = new NLHUIAdapter();
    const noBetSnapshot = buildSnapshot({ currentBet: 20, players: [
      {
        seatIndex: 0,
        name: "Hero",
        stack: 1000,
        betThisStreet: 20,
        totalInvested: 20,
        holeCards: ["AS", "KS"],
        folded: false,
      },
      {
        seatIndex: 1,
        name: "CPU",
        stack: 1000,
        betThisStreet: 20,
        totalInvested: 20,
        holeCards: ["QD", "JC"],
        folded: false,
      },
      {
        seatIndex: 2,
        name: "CPU 2",
        stack: 1000,
        betThisStreet: 20,
        totalInvested: 20,
        holeCards: ["9H", "9D"],
        folded: false,
      },
    ] });
    const actionsNoBet = adapter.getAvailableActions({
      controllerSnapshot: noBetSnapshot,
      seatIndex: 0,
    });
    expect(actionsNoBet).toContain("check");
    expect(actionsNoBet).toContain("bet");
    const facingBet = buildSnapshot({
      currentBet: 40,
      players: [
        {
          seatIndex: 0,
          name: "Hero",
          stack: 1000,
          betThisStreet: 20,
          totalInvested: 20,
          holeCards: ["AS", "KS"],
          folded: false,
        },
        {
          seatIndex: 1,
          name: "CPU",
          stack: 1000,
          betThisStreet: 40,
          totalInvested: 40,
          holeCards: ["QD", "JC"],
          folded: false,
        },
      ],
    });
    const facingActions = adapter.getAvailableActions({
      controllerSnapshot: facingBet,
      seatIndex: 0,
    });
    expect(facingActions).toContain("fold");
    expect(facingActions).toContain("call");
    expect(facingActions).toContain("raise");
  });
});
