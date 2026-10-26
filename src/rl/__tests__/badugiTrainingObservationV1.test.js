import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/badugiTrainingObservationV1.json";
import { buildBadugiTrainingObservationV1 } from "../badugiTrainingObservationV1.js";

describe("six-max Badugi training observation contract", () => {
  for (const fixture of fixtures.cases) {
    it(`matches the Python training environment for ${fixture.name}`, () => {
      const actual = buildBadugiTrainingObservationV1(fixture.input);
      expect(actual).toHaveLength(96);
      for (let slot = 0; slot < 96; slot += 1) {
        expect(Math.abs(actual[slot] - fixture.expected[slot]), `slot ${slot}`).toBeLessThan(1e-6);
      }
    });
  }

  it("rejects browser card strings until a verified state adapter is provided", () => {
    const fixture = fixtures.cases[0];
    const players = fixture.input.state.players.map((player) => ({ ...player }));
    players[fixture.input.seatIndex].hand = ["AS", "2D", "3C", "4H"];
    expect(() => buildBadugiTrainingObservationV1({
      ...fixture.input,
      state: { ...fixture.input.state, players },
    })).toThrow(/zero-based rank\/suit cards/);
  });
});
