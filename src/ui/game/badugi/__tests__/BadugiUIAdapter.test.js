import { describe, expect, it } from "vitest";
import { BadugiUIAdapter } from "../BadugiUIAdapter.js";

const baseSnapshot = {
  phase: "BET",
  drawRound: 0,
  betRoundIndex: 0,
  dealerIdx: 0,
  turn: 0,
  currentBet: 10,
  players: [
    {
      name: "Hero",
      stack: 490,
      betThisRound: 10,
      hand: ["AS", "KH", "QC", "JD"],
      selected: [0],
    },
    {
      name: "CPU 1",
      stack: 495,
      betThisRound: 5,
      hand: ["2S", "3H", "4C", "5D"],
    },
  ],
  pots: [{ amount: 30, eligible: [0, 1] }],
};

const mockSnapshot = (overrides = {}) => ({
  ...baseSnapshot,
  ...overrides,
  players: (overrides.players ?? baseSnapshot.players).map((player) => ({ ...player })),
  pots: (overrides.pots ?? baseSnapshot.pots).map((pot) => ({ ...pot })),
});

const mockTableConfig = {
  levelNumber: 1,
  sbValue: 5,
  bbValue: 10,
  anteValue: 0,
  handCount: 1,
  handsCap: 5,
  startingStack: 500,
  maxDraws: 3,
};

describe("BadugiUIAdapter", () => {
  it("creates an initial view state object", () => {
    const adapter = new BadugiUIAdapter({});
    const viewState = adapter.createInitialViewState({
      controllerSnapshot: mockSnapshot(),
      tableConfig: mockTableConfig,
    });
    expect(viewState).toHaveProperty("controllerSnapshot");
    expect(viewState).toHaveProperty("tableConfig");
  });

  it("builds view props containing phase, seats, controls, pot, and hud info", () => {
    const adapter = new BadugiUIAdapter({});
    const props = adapter.buildViewProps({
      controllerSnapshot: mockSnapshot(),
      tableConfig: mockTableConfig,
    });

    expect(props.tablePhase).toBe("BET");
    expect(Array.isArray(props.seatViews)).toBe(true);
    expect(props.seatViews).toHaveLength(2);
    expect(props.seatViews[0]).toHaveProperty("isHero", true);
    expect(props.potView.total).toBe(30);
    expect(props.controlsConfig).toMatchObject({
      phase: "BET",
      heroTurn: true,
    });
    expect(props.hudInfo).toMatchObject({
      levelNumber: 1,
      sbValue: 5,
      bbValue: 10,
    });
  });

  it("uses dealerIndex for HUD dealer name when dealerIdx is absent", () => {
    const adapter = new BadugiUIAdapter({});
    const props = adapter.buildViewProps({
      controllerSnapshot: mockSnapshot({
        dealerIdx: undefined,
        dealerIndex: 2,
        players: [
          { name: "Hero", stack: 500, hand: ["AS", "2H", "3C", "4D"] },
          { name: "CPU 1", stack: 500, hand: ["5S", "6H", "7C", "8D"] },
          { name: "CPU 2", stack: 500, hand: ["9S", "TH", "JC", "QD"] },
        ],
      }),
      tableConfig: mockTableConfig,
    });

    expect(props.hudInfo.dealerName).toBe("CPU 2");
  });

  it("falls back to dealerIdx for HUD dealer name", () => {
    const adapter = new BadugiUIAdapter({});
    const props = adapter.buildViewProps({
      controllerSnapshot: mockSnapshot({
        dealerIdx: 1,
        players: [
          { name: "Hero", stack: 500, hand: ["AS", "2H", "3C", "4D"] },
          { name: "CPU 1", stack: 500, hand: ["5S", "6H", "7C", "8D"] },
          { name: "CPU 2", stack: 500, hand: ["9S", "TH", "JC", "QD"] },
        ],
      }),
      tableConfig: mockTableConfig,
    });

    expect(props.hudInfo.dealerName).toBe("CPU 1");
  });

  it("hides Raise when the fixed-limit cap is reached", () => {
    const adapter = new BadugiUIAdapter({});
    const cappedSnapshot = mockSnapshot({
      raiseCountThisRound: 4,
      raiseCap: 4,
      metadata: {
        raiseCountThisRound: 4,
        raiseCap: 4,
      },
    });
    const props = adapter.buildViewProps({
      controllerSnapshot: cappedSnapshot,
      tableConfig: mockTableConfig,
    });

    expect(props.controlsConfig.canRaise).toBe(false);
    expect(
      adapter.getAvailableActions({ controllerSnapshot: cappedSnapshot, seatIndex: 0 }),
    ).not.toContain("raise");
  });

  it("hides Raise when no active non-all-in opponent can respond", () => {
    const adapter = new BadugiUIAdapter({});
    const allInOpponentSnapshot = mockSnapshot({
      players: [
        {
          name: "Hero",
          stack: 490,
          betThisRound: 10,
          hand: ["AS", "KH", "QC", "JD"],
          selected: [0],
        },
        {
          name: "CPU 1",
          stack: 0,
          betThisRound: 10,
          hand: ["2S", "3H", "4C", "5D"],
          allIn: true,
        },
      ],
    });
    const props = adapter.buildViewProps({
      controllerSnapshot: allInOpponentSnapshot,
      tableConfig: mockTableConfig,
    });

    expect(props.controlsConfig.canCheck).toBe(true);
    expect(props.controlsConfig.canRaise).toBe(false);
    expect(
      adapter.getAvailableActions({ controllerSnapshot: allInOpponentSnapshot, seatIndex: 0 }),
    ).not.toContain("raise");
  });

  it("uses player avatarUrl as the seat avatar when present", () => {
    const adapter = new BadugiUIAdapter({});
    const props = adapter.buildViewProps({
      controllerSnapshot: mockSnapshot({
        players: [
          {
            name: "Hero",
            stack: 490,
            betThisRound: 10,
            hand: ["AS", "KH", "QC", "JD"],
            selected: [0],
          },
          {
            name: "Akira",
            stack: 495,
            betThisRound: 5,
            hand: ["2S", "3H", "4C", "5D"],
            avatarUrl: "/characters/akira.png",
          },
        ],
      }),
      tableConfig: mockTableConfig,
    });

    expect(props.seatViews[1]).toMatchObject({
      avatar: "/characters/akira.png",
      avatarUrl: "/characters/akira.png",
    });
  });

  it("formats street labels", () => {
    const adapter = new BadugiUIAdapter({});
    expect(adapter.formatStreetLabel("BET")).toBe("Betting");
    expect(adapter.formatStreetLabel("DRAW")).toBe("Draw");
    expect(adapter.formatStreetLabel("SHOWDOWN")).toBe("Showdown");
    expect(adapter.formatStreetLabel("Other")).toBe("Other");
  });

  it("derives available hero actions", () => {
    const adapter = new BadugiUIAdapter({});
    const actions = adapter.getAvailableActions({
      controllerSnapshot: mockSnapshot(),
      seatIndex: 0,
    });
    expect(actions).toContain("fold");
    expect(actions).toContain("check");
    expect(actions).toContain("raise");
  });

  it("exposes fixed-limit bet sizing per street", () => {
    const adapter = new BadugiUIAdapter({});
    const preDraw = adapter.buildViewProps({
      controllerSnapshot: mockSnapshot({ drawRound: 0 }),
      tableConfig: mockTableConfig,
    });
    expect(preDraw.controlsConfig.betSize).toBe(mockTableConfig.bbValue);
    expect(preDraw.controlsConfig.isBigBetStreet).toBe(false);

    const postDraw = adapter.buildViewProps({
      controllerSnapshot: mockSnapshot({ drawRound: 1 }),
      tableConfig: mockTableConfig,
    });
    expect(postDraw.controlsConfig.betSize).toBe(mockTableConfig.bbValue * 2);
    expect(postDraw.controlsConfig.isBigBetStreet).toBe(true);
  });

  it("compresses seat labels when busted seats are between blinds", () => {
    const adapter = new BadugiUIAdapter({});
    const props = adapter.buildViewProps({
      controllerSnapshot: mockSnapshot({
        dealerIdx: 3,
        players: [
          { name: "Hero", stack: 1100, betThisRound: 30, hand: ["AS", "2H", "3C", "4D"] },
          { name: "CPU 2", stack: 230, betThisRound: 0, hand: ["5S", "6H", "7C", "8D"] },
          { name: "CPU 3", stack: 0, betThisRound: 0, seatOut: true, isBusted: true, folded: true },
          { name: "CPU 4", stack: 1350, betThisRound: 0, hand: ["9S", "TH", "JC", "QD"] },
          { name: "CPU 5", stack: 275, betThisRound: 15, hand: ["KS", "AH", "2C", "3D"] },
          { name: "CPU 6", stack: 0, betThisRound: 0, seatOut: true, isBusted: true, folded: true },
        ],
      }),
      tableConfig: mockTableConfig,
    });

    expect(props.seatViews[3].label).toBe("BTN");
    expect(props.seatViews[4].label).toBe("SB");
    expect(props.seatViews[0].label).toBe("BB");
    expect(props.seatViews[1].label).toBe("UTG");
    expect(props.seatViews[5].label).toBe("OUT");
    expect(props.seatViews[0].isBB).toBe(true);
    expect(props.seatViews[4].isSB).toBe(true);
  });
});
