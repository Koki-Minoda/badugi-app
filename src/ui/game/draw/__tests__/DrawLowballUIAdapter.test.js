import { describe, expect, it, beforeEach } from "vitest";
import { AceToFiveSingleDrawController } from "../../../../games/draw/AceToFiveSingleDrawController.js";
import { AceToFiveSingleDrawEngine } from "../../../../games/draw/AceToFiveSingleDrawEngine.js";
import { AceToFiveTripleDrawController } from "../../../../games/draw/AceToFiveTripleDrawController.js";
import { AceToFiveTripleDrawEngine } from "../../../../games/draw/AceToFiveTripleDrawEngine.js";
import { DeuceToSevenSingleDrawController } from "../../../../games/draw/DeuceToSevenSingleDrawController.js";
import { DeuceToSevenSingleDrawEngine } from "../../../../games/draw/DeuceToSevenSingleDrawEngine.js";
import { DeuceToSevenTripleDrawController } from "../../../../games/draw/DeuceToSevenTripleDrawController.js";
import { DeuceToSevenTripleDrawEngine } from "../../../../games/draw/DeuceToSevenTripleDrawEngine.js";
import {
  clearGameUIAdapters,
  getGameUIAdapter,
} from "../../GameUIAdapterRegistry.js";
import { DrawLowballUIAdapter } from "../DrawLowballUIAdapter.js";
import {
  DRAW_LOWBALL_UI_VARIANT_IDS,
  ensureDrawLowballUIAdaptersRegistered,
} from "../registerDrawLowballUIAdapters.js";

class FakeDeckManager {
  constructor(cards = []) {
    this.cards = [...cards];
    this.discardPile = [];
  }

  reset() {}

  draw(count = 1) {
    return this.cards.splice(0, count);
  }

  discard(cards = []) {
    this.discardPile.push(...cards);
  }
}

const controllerCases = [
  {
    name: "D01",
    Controller: DeuceToSevenTripleDrawController,
    Engine: DeuceToSevenTripleDrawEngine,
    cards: ["7S", "5D", "4C", "3H", "2S", "8S", "6D", "5C", "3S", "2C"],
    drawRounds: 3,
  },
  {
    name: "D02",
    Controller: AceToFiveTripleDrawController,
    Engine: AceToFiveTripleDrawEngine,
    cards: ["AS", "2S", "3S", "4S", "5S", "6D", "4C", "3H", "2D", "AC"],
    drawRounds: 3,
  },
  {
    name: "S01",
    Controller: DeuceToSevenSingleDrawController,
    Engine: DeuceToSevenSingleDrawEngine,
    cards: ["7S", "5D", "4C", "3H", "2S", "8S", "6D", "5C", "3S", "2C"],
    drawRounds: 1,
  },
  {
    name: "S02",
    Controller: AceToFiveSingleDrawController,
    Engine: AceToFiveSingleDrawEngine,
    cards: ["AS", "2S", "3S", "4S", "5S", "6D", "4C", "3H", "2D", "AC"],
    drawRounds: 1,
  },
];

function buildController({ Controller, Engine, cards }) {
  return new Controller({
    engine: new Engine({
      deckManager: new FakeDeckManager(cards),
    }),
    tableConfig: {
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
      structure: { sb: 10, bb: 20 },
    },
  });
}

describe("DrawLowballUIAdapter", () => {
  beforeEach(() => {
    clearGameUIAdapters();
  });

  it.each(controllerCases)(
    "builds table props for $name controller snapshots",
    (entry) => {
      const controller = buildController(entry);
      const state = controller.createNewHandState(controller.createInitialState());
      const adapter = new DrawLowballUIAdapter();

      const props = adapter.buildViewProps({
        controllerSnapshot: state.snapshot,
        tableConfig: {
          levelNumber: 1,
          sbValue: 10,
          bbValue: 20,
          maxDraws: entry.drawRounds,
        },
      });

      expect(props.tablePhase).toBe("BET");
      expect(props.seatViews).toHaveLength(2);
      expect(props.seatViews[0]).toMatchObject({
        isHero: true,
        hand: expect.arrayContaining(state.snapshot.players[0].hand),
      });
      expect(props.seatViews[0].hand).toHaveLength(5);
      expect(props.controlsConfig).toMatchObject({
        phase: "BET",
        heroStack: expect.any(Number),
        currentBet: 20,
      });
      expect(props.hudInfo).toMatchObject({
        phase: "BET",
        maxDraws: entry.drawRounds,
      });
      expect(props.potView.total).toBe(30);
    },
  );

  it("registers aliases for implemented draw lowball variants", () => {
    ensureDrawLowballUIAdaptersRegistered();

    for (const variantId of DRAW_LOWBALL_UI_VARIANT_IDS) {
      expect(getGameUIAdapter(variantId)).toBeInstanceOf(DrawLowballUIAdapter);
    }
  });
});
