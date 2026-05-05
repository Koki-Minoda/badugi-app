import { describe, it, expect } from "vitest";
import { NLHUIAdapter } from "../NLHUIAdapter.js";
import { ensureNLHUIAdapterRegistered } from "../registerNLHUIAdapter.js";
import { getGameUIAdapter } from "../../GameUIAdapterRegistry.js";
import { APP_VARIANT_IDS } from "../../appVariantRouting.js";

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
  it("registers board fixed-limit and stud-family aliases", () => {
    const adapter = ensureNLHUIAdapterRegistered({ force: true });

    expect(getGameUIAdapter(APP_VARIANT_IDS.NLH)).toBe(adapter);
    expect(getGameUIAdapter(APP_VARIANT_IDS.FLH)).toBe(adapter);
    expect(getGameUIAdapter(APP_VARIANT_IDS.STUD)).toBe(adapter);
    expect(getGameUIAdapter(APP_VARIANT_IDS.STUD8)).toBe(adapter);
    expect(getGameUIAdapter(APP_VARIANT_IDS.RAZZ)).toBe(adapter);
    expect(getGameUIAdapter(APP_VARIANT_IDS.RAZZ27)).toBe(adapter);
    expect(getGameUIAdapter(APP_VARIANT_IDS.RAZZDUGI)).toBe(adapter);
    expect(getGameUIAdapter(APP_VARIANT_IDS.RAZZDUCEY)).toBe(adapter);
  });

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

  it("keeps stud up-cards visible while down-cards stay hidden before showdown", () => {
    const adapter = new NLHUIAdapter();
    const snapshot = buildSnapshot({
      street: "THIRD",
      players: [
        {
          seatIndex: 0,
          name: "Hero",
          stack: 980,
          betThisStreet: 0,
          totalInvested: 0,
          holeCards: ["AS", "KD", "2C"],
          downCards: ["AS", "KD"],
          upCards: ["2C"],
          folded: false,
        },
        {
          seatIndex: 1,
          name: "Razz CPU",
          stack: 990,
          betThisStreet: 0,
          totalInvested: 0,
          holeCards: ["QS", "JD", "9C"],
          downCards: ["QS", "JD"],
          upCards: ["9C"],
          folded: false,
        },
      ],
    });

    const view = adapter.buildViewProps({ controllerSnapshot: snapshot, tableConfig });

    expect(view.seatViews[0].cards).toEqual(["AS", "KD", "2C"]);
    expect(view.seatViews[0].hand).toEqual(["AS", "KD", "2C"]);
    expect(view.seatViews[0].cardVisibility).toEqual(["down", "down", "up"]);
    expect(view.seatViews[1].cards).toEqual(["QS", "JD", "9C"]);
    expect(view.seatViews[1].hand).toEqual(["QS", "JD", "9C"]);
    expect(view.seatViews[1].cardVisibility).toEqual(["down", "down", "up"]);
    expect(view.hudInfo.streetLabel).toBe("3rd Street");
  });

  it("preserves image avatar URLs in seat views", () => {
    const adapter = new NLHUIAdapter();
    const snapshot = buildSnapshot({
      players: [
        {
          seatIndex: 0,
          name: "Hero",
          avatarUrl: "/characters/hero.png",
          stack: 980,
          betThisStreet: 20,
          totalInvested: 20,
          holeCards: ["AS", "KS"],
          folded: false,
        },
        {
          seatIndex: 1,
          name: "Kei",
          avatarUrl: "/characters/kei.png",
          stack: 990,
          betThisStreet: 20,
          totalInvested: 20,
          holeCards: ["QD", "JC"],
          folded: false,
        },
      ],
    });

    const view = adapter.buildViewProps({ controllerSnapshot: snapshot, tableConfig });

    expect(view.seatViews[0]).toMatchObject({
      avatar: "/characters/hero.png",
      avatarUrl: "/characters/hero.png",
    });
    expect(view.seatViews[1]).toMatchObject({
      avatar: "/characters/kei.png",
      avatarUrl: "/characters/kei.png",
    });
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
