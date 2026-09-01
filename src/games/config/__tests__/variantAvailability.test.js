import { describe, expect, it } from "vitest";
import {
  PUBLIC_PLAYABLE_VARIANTS,
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
    expect(getVariantAvailability("nlh").availability).toBe(
      VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE,
    );
  });

  it("keeps the public release manifest equal to every alpha-playable variant", () => {
    const manifestKeys = PUBLIC_PLAYABLE_VARIANTS.map((entry) => entry.availabilityKey).sort();
    const alphaKeys = listVariantAvailability()
      .filter((entry) => entry.availability === VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE)
      .map((entry) => entry.key)
      .sort();

    expect(manifestKeys).toEqual(alphaKeys);
    expect(new Set(PUBLIC_PLAYABLE_VARIANTS.map((entry) => entry.id)).size).toBe(
      PUBLIC_PLAYABLE_VARIANTS.length,
    );
    for (const entry of PUBLIC_PLAYABLE_VARIANTS) {
      expect(getVariantAvailability(entry.id).availability).toBe(
        VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE,
      );
    }
  });

  it("includes Badugi in the friend alpha scope", () => {
    const badugi = getVariantAvailability("badugi");
    expect(badugi.availability).toBe(VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE);
    expect(badugi.alphaPlayable).toBe(true);
    expect(badugi.statusLabel).toBe("Alpha");
    expect(badugi.reason).toMatch(/Core MGX alpha game/i);
  });

  it("publishes NLH only with its completed release contract", () => {
    const nlh = getVariantAvailability("nlh");
    expect(nlh.availability).toBe(VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE);
    expect(nlh.reason).toMatch(/store\/local tournament/i);
    expect(nlh.requiredBeforeAlpha).toEqual([]);
    expect(PUBLIC_PLAYABLE_VARIANTS.find((entry) => entry.id === "nlh")?.cashQm).toEqual({
      expectsDraw: false,
      expectsBlindIncrease: false,
    });
  });

  it("publishes all six Stud-family games only with the completed release contract", () => {
    for (const id of ["stud", "stud8", "razz", "razzdugi", "razzducey", "razz27"]) {
      const entry = getVariantAvailability(id);
      expect(entry.availability).toBe(VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE);
      expect(entry.reason).toMatch(/all-in\/side-pot settlement/i);
      expect(entry.requiredBeforeAlpha).toEqual([]);
      expect(PUBLIC_PLAYABLE_VARIANTS.find((variant) => variant.id === id)?.cashQm).toEqual({
        expectsDraw: false,
        expectsBlindIncrease: false,
      });
    }
  });

  it("publishes all six Dramaha games only with their completed release contract", () => {
    for (const id of [
      "dramaha_hi",
      "dramaha_27",
      "dramaha_a5",
      "dramaha_zero",
      "dramaha_hidugi",
      "dramaha_badugi",
    ]) {
      const entry = getVariantAvailability(id);
      expect(entry.availability).toBe(VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE);
      expect(entry.reason).toMatch(/split and odd-chip settlement/i);
      expect(entry.requiredBeforeAlpha).toEqual([]);
      expect(PUBLIC_PLAYABLE_VARIANTS.find((variant) => variant.id === id)?.cashQm).toEqual({
        expectsDraw: true,
        expectsBlindIncrease: false,
      });
    }
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
