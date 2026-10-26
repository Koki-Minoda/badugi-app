import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/drawTrainingObservationV1.json";
import { buildDrawTrainingObservationV1 } from "../drawTrainingObservationV1.js";

describe("six-max draw training observation contract", () => {
  for (const fixture of fixtures.cases) {
    it(`matches the Python training environment for ${fixture.name}`, () => {
      const actual = buildDrawTrainingObservationV1(fixture.input);
      expect(actual).toHaveLength(96);
      for (let slot = 0; slot < 96; slot += 1) {
        expect(Math.abs(actual[slot] - fixture.expected[slot]), `slot ${slot}`).toBeLessThan(1e-6);
      }
    });
  }

  it("rejects unadapted browser cards", () => {
    const fixture = fixtures.cases[0];
    const players = fixture.input.state.players.map((player) => ({ ...player }));
    players[fixture.input.seatIndex].hand = ["2C", "3D", "4H", "5S", "7C"];
    expect(() => buildDrawTrainingObservationV1({
      ...fixture.input,
      state: { ...fixture.input.state, players },
    })).toThrow(/numeric rank\/suit cards/);
  });
});
