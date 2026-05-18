import { describe, expect, it } from "vitest";
import { DeuceToSevenTripleDrawController } from "../../games/draw/DeuceToSevenTripleDrawController.js";
import { DrawLowballUIAdapter } from "../game/draw/DrawLowballUIAdapter.js";

const STRUCTURE = { sb: 10, bb: 20, ante: 0 };
const SEATS = ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"];

function createD01Snapshot({ dealerIndex = 3 } = {}) {
  const controller = new DeuceToSevenTripleDrawController({
    tableConfig: {
      seatConfig: SEATS,
      dealerIndex,
      startingStack: 600,
      structure: STRUCTURE,
    },
  });
  return controller.createNewHandState({}, { dealerIndex, structure: STRUCTURE }).snapshot;
}

describe("Draw lowball opening actor badge consistency", () => {
  it("shows Hero as UTG only when Hero is the canonical opening actor", () => {
    const snapshot = createD01Snapshot({ dealerIndex: 3 });
    const adapter = new DrawLowballUIAdapter();
    const props = adapter.buildViewProps({
      controllerSnapshot: snapshot,
      tableConfig: {
        dealerIndex: 0,
        sbValue: 10,
        bbValue: 20,
        anteValue: 0,
        maxDraws: 3,
      },
    });

    expect(snapshot.metadata.lastBlinds).toMatchObject({ sbIndex: 4, bbIndex: 5 });
    expect(snapshot.turn).toBe(0);
    expect(props.seatViews[0]).toMatchObject({
      label: "UTG",
      isTurn: true,
      betThisRound: 0,
    });
    expect(props.seatViews[1]).toMatchObject({
      label: "MP",
      isTurn: false,
      betThisRound: 0,
    });
    expect(props.seatViews[3]).toMatchObject({
      label: "BTN",
      isDealer: true,
    });
    expect(props.seatViews[4]).toMatchObject({ label: "SB", isSB: true });
    expect(props.seatViews[5]).toMatchObject({ label: "BB", isBB: true });
    expect(props.controlsConfig.heroTurn).toBe(true);
    expect(props.controlsConfig.needsToCall).toBe(true);
    expect(props.controlsConfig.currentBet).toBe(20);
  });

  it("keeps badges, turn, and blind posts aligned after UTG acts and MP becomes actor", () => {
    const controller = new DeuceToSevenTripleDrawController({
      tableConfig: {
        seatConfig: SEATS,
        dealerIndex: 3,
        startingStack: 600,
        structure: STRUCTURE,
      },
    });
    const state = controller.createNewHandState({}, { dealerIndex: 3, structure: STRUCTURE });
    const afterHeroCall = controller.applyAction(state, { seatIndex: 0, type: "call" }).state.snapshot;
    const adapter = new DrawLowballUIAdapter();
    const props = adapter.buildViewProps({
      controllerSnapshot: afterHeroCall,
      tableConfig: { sbValue: 10, bbValue: 20, anteValue: 0, maxDraws: 3 },
    });

    expect(afterHeroCall.turn).toBe(1);
    expect(props.seatViews[0]).toMatchObject({
      label: "UTG",
      isTurn: false,
      betThisRound: 20,
    });
    expect(props.seatViews[1]).toMatchObject({
      label: "MP",
      isTurn: true,
      betThisRound: 0,
    });
    expect(props.controlsConfig.heroTurn).toBe(false);
  });
});
