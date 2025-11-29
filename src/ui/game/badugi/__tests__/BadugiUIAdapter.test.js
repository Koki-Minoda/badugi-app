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
});
