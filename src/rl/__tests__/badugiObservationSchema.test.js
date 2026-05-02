import { describe, expect, it } from "vitest";
import { BadugiEngine } from "../../games/badugi/engine/BadugiEngine.js";
import {
  BADUGI_OBSERVATION_SCHEMA_VERSION,
  BADUGI_OBSERVATION_VECTOR_SIZE,
  buildBadugiObservationPayload,
  buildBadugiObservationVector,
  chooseDeterministicSafeAction,
  isValidBadugiObservationVector,
} from "../badugiObservationSchema.js";

describe("badugi observation schema v1", () => {
  const state = {
    gameId: "badugi",
    handId: "H1",
    street: "BET",
    drawRoundIndex: 1,
    dealerIndex: 0,
    actingPlayerIndex: 1,
    pots: [{ amount: 120 }],
    players: [
      { id: "seat-0", seatIndex: 0, stack: 480, hand: ["AS", "2D", "3C", "4H"] },
      { id: "seat-1", seatIndex: 1, stack: 420, hand: ["KS", "KD", "7C", "2H"] },
    ],
  };

  it("builds a stable 96-slot vector from table state", () => {
    const observation = buildBadugiObservationPayload({
      state,
      seatIndex: 1,
      legalActions: ["call", "raise", "fold"],
    });
    const vector = buildBadugiObservationVector(observation);

    expect(observation.schemaVersion).toBe(BADUGI_OBSERVATION_SCHEMA_VERSION);
    expect(observation.features.madeCards).toBeGreaterThan(0);
    expect(vector).toHaveLength(BADUGI_OBSERVATION_VECTOR_SIZE);
    expect(isValidBadugiObservationVector(vector)).toBe(true);
    expect(vector[27]).toBeGreaterThan(0); // starting hand strength
    expect(vector[28]).toBeGreaterThanOrEqual(0); // pot odds
    expect(vector[31]).toBeGreaterThanOrEqual(0); // one-away flag
    expect(vector[32]).toBe(1); // fold mask
    expect(vector[34]).toBe(1); // call mask
    expect(vector[36]).toBe(1); // raise mask
  });

  it("exposes final-street Badugi context without moving action-mask slots", () => {
    const observation = buildBadugiObservationPayload({
      state: {
        ...state,
        drawRoundIndex: 3,
        street: "BET",
        players: [
          {
            id: "seat-0",
            seatIndex: 0,
            stack: 480,
            hand: ["AS", "2D", "3C", "4H"],
            lastDrawCount: 2,
            stats: { aggressionRate: 0.4, foldRate: 0.35, patRate: 0.2 },
            profile: { bluffFrequency: 0.12 },
          },
          { id: "seat-1", seatIndex: 1, stack: 420, hand: ["AS", "5D", "9C", "KH"] },
        ],
      },
      seatIndex: 1,
      legalActions: ["check", "bet"],
    });
    const vector = buildBadugiObservationVector(observation);

    expect(vector[32]).toBe(0); // fold mask remains fixed
    expect(vector[33]).toBe(1); // check mask remains fixed
    expect(vector[35]).toBe(1); // bet mask remains fixed
    expect(vector[38]).toBeGreaterThan(0); // street-adjusted strength
    expect(vector[39]).toBeGreaterThan(0); // opponent drew 2 on final draw
    expect(vector[40]).toBe(1); // final BET round
    expect(vector[41]).toBe(1); // K-high Badugi is weak final value
    expect(vector[42]).toBeGreaterThan(0); // opponent aggression
    expect(vector[44]).toBeGreaterThan(0); // opponent pat rate
    expect(vector[46]).toBeGreaterThan(0); // opponent foldability
    expect(vector[47]).toBeGreaterThan(0); // opponent bluff frequency
    expect(vector[48]).toBeGreaterThan(0); // estimated equity
    expect(vector[49]).toBeGreaterThanOrEqual(0); // pot odds
    expect(vector[50]).toBeGreaterThanOrEqual(-1); // call EV
    expect(vector[52]).toBeGreaterThanOrEqual(0); // draw equity
    expect(vector[54]).toBeGreaterThanOrEqual(0); // future street value
    expect(vector[55]).toBeGreaterThanOrEqual(0); // cheap draw continue value
  });

  it("aligns BadugiEngine.getObservation with schema v1", () => {
    const engine = new BadugiEngine();
    const observation = engine.getObservation(state, "seat-1");

    expect(observation.schemaVersion).toBe(BADUGI_OBSERVATION_SCHEMA_VERSION);
    expect(observation.stateVector).toHaveLength(BADUGI_OBSERVATION_VECTOR_SIZE);
    expect(observation.observation.seatIndex).toBe(1);
  });

  it("chooses deterministic safe fallback actions by priority", () => {
    expect(chooseDeterministicSafeAction(["raise", "call", "fold"])).toBe("call");
    expect(chooseDeterministicSafeAction(["raise", "fold"])).toBe("fold");
    expect(chooseDeterministicSafeAction([])).toBeNull();
  });
});
