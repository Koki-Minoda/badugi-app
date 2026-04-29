import { describe, expect, it } from "vitest";
import { DeuceToSevenTripleDrawEngine } from "../../games/draw/DeuceToSevenTripleDrawEngine.js";
import { AceToFiveTripleDrawEngine } from "../../games/draw/AceToFiveTripleDrawEngine.js";
import {
  DRAW_OBSERVATION_SCHEMA_VERSION,
  buildDrawObservationPayload,
  buildDrawObservationVector,
  getDrawVariantRlConfig,
  wrapRuleBasedDrawDecision,
} from "../drawObservationSchema.js";
import { buildDrawBootstrapDataset } from "../drawBootstrapDataset.js";

describe("draw observation schema", () => {
  it("builds common D01 2-7 lowball vectors with variant feature slots", () => {
    const state = {
      street: "DRAW",
      drawRoundIndex: 2,
      metadata: { variantId: "D01", currentBet: 20 },
      players: [{ hand: ["2S", "2H", "9C", "KD", "QS"], stack: 500 }],
    };
    const payload = buildDrawObservationPayload({
      state,
      seatIndex: 0,
      variantId: "D01",
      legalActions: ["draw_0", "draw_1", "draw_2", "draw_3"],
    });
    const vector = buildDrawObservationVector(payload);

    expect(payload.schemaVersion).toBe(DRAW_OBSERVATION_SCHEMA_VERSION);
    expect(payload.family).toBe("low-27");
    expect(vector).toHaveLength(96);
    expect(vector[41]).toBe(1);
    expect(vector[42]).toBe(0);
    expect(vector[48 + 5]).toBe(1); // draw_0
    expect(vector[48 + 8]).toBe(1); // draw_3
  });

  it("builds A-5 vectors with a distinct variant feature slot", () => {
    const payload = buildDrawObservationPayload({
      state: {
        street: "DRAW",
        metadata: { variantId: "D02" },
        players: [{ hand: ["AS", "2D", "3C", "4H", "5S"], stack: 500 }],
      },
      seatIndex: 0,
      variantId: "D02",
    });
    const vector = buildDrawObservationVector(payload);

    expect(payload.family).toBe("low-a5");
    expect(vector[41]).toBe(0);
    expect(vector[42]).toBe(1);
  });

  it("exposes variant-specific draw RL config", () => {
    expect(getDrawVariantRlConfig("D01")).toMatchObject({
      family: "low-27",
      handSize: 5,
      drawRounds: 3,
    });
    expect(getDrawVariantRlConfig("S02")).toMatchObject({
      family: "low-a5",
      handSize: 5,
      drawRounds: 1,
    });
  });

  it("wraps D01/D02 rule-based CPU decisions as replaceable RL fallbacks", () => {
    const d01 = new DeuceToSevenTripleDrawEngine();
    const d02 = new AceToFiveTripleDrawEngine();
    const d01State = d01.transitionToDraw(d01.initHand({ seatConfig: ["HUMAN", "CPU"] }), 1);
    d01State.actingPlayerIndex = 1;
    d01State.players[1].hand = ["2S", "2H", "9C", "KD", "QS"];
    const d02State = d02.transitionToDraw(d02.initHand({ seatConfig: ["HUMAN", "CPU"] }), 1);
    d02State.actingPlayerIndex = 1;
    d02State.players[1].hand = ["AS", "2D", "3C", "4H", "5S"];

    expect(wrapRuleBasedDrawDecision({ engine: d01, state: d01State, seatIndex: 1 })).toMatchObject({
      source: "rule-based-draw",
      type: "DRAW",
      metadata: { replaceableByRl: true, strategy: "ruleBasedD01" },
    });
    expect(wrapRuleBasedDrawDecision({ engine: d02, state: d02State, seatIndex: 1 })).toMatchObject({
      source: "rule-based-draw",
      type: "DRAW",
      metadata: { replaceableByRl: true, strategy: "ruleBasedD02" },
    });
  });

  it("cuts supervised bootstrap records from the draw heuristic", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.transitionToDraw(engine.initHand({ seatConfig: ["HUMAN", "CPU"] }), 1);
    state.actingPlayerIndex = 1;
    state.players[1].hand = ["2S", "2H", "9C", "KD", "QS"];

    const dataset = buildDrawBootstrapDataset([
      {
        engine,
        state,
        seatIndex: 1,
        legalActions: ["draw_0", "draw_1", "draw_2", "draw_3"],
      },
    ]);

    expect(dataset).toMatchObject({
      schema_version: "draw-observation-v1",
      format: "supervised-bootstrap",
      count: 1,
    });
    expect(dataset.records[0].observation).toHaveLength(96);
    expect(dataset.records[0].action).toBe("draw_3");
    expect(dataset.records[0].metadata.strategy).toBe("ruleBasedD01");
  });
});
