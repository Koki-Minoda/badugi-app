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
    expect(vector[32]).toBe(1); // fold mask
    expect(vector[34]).toBe(1); // call mask
    expect(vector[36]).toBe(1); // raise mask
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
