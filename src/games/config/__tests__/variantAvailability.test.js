import { describe, expect, it } from "vitest";
import {
  VARIANT_AVAILABILITY,
  VARIANT_AVAILABILITY_STATES,
  getVariantAvailability,
  listVariantAvailability,
} from "../variantAvailability.js";

describe("variantAvailability", () => {
  it("classifies alpha playable variants conservatively", () => {
    expect(getVariantAvailability("D01").availability).toBe(
      VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE,
    );
    expect(getVariantAvailability("badugi").availability).toBe(
      VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE,
    );
    expect(getVariantAvailability("D02").availability).toBe(
      VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE,
    );
    expect(getVariantAvailability("S01").availability).toBe(
      VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE,
    );
    expect(getVariantAvailability("S02").availability).toBe(
      VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE,
    );
  });

  it("includes Badugi in the friend alpha scope", () => {
    const badugi = getVariantAvailability("badugi");
    expect(badugi.availability).toBe(VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE);
    expect(badugi.alphaPlayable).toBe(true);
    expect(badugi.statusLabel).toBe("Alpha");
    expect(badugi.reason).toMatch(/Core MGX alpha game/i);
  });

  it("marks Chinese/OFC as coming soon and keeps unknown variants unavailable", () => {
    expect(getVariantAvailability("ofc").availability).toBe(
      VARIANT_AVAILABILITY_STATES.COMING_SOON,
    );
    expect(getVariantAvailability("unknown_variant").availability).toBe(
      VARIANT_AVAILABILITY_STATES.COMING_SOON,
    );
  });

  it("has only audited availability states", () => {
    const validStates = new Set(Object.values(VARIANT_AVAILABILITY_STATES));
    for (const entry of Object.values(VARIANT_AVAILABILITY)) {
      expect(validStates.has(entry.availability)).toBe(true);
      expect(entry.previewOnly).toBe(true);
    }
    expect(listVariantAvailability().length).toBeGreaterThan(0);
  });
});
