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
});
