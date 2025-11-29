import { describe, it, expect } from "vitest";
import {
  createVariantRotationController,
  getCurrentVariant,
  getNextVariant,
  advanceVariantRotation,
} from "../variantRotationController.js";

describe("variantRotationController", () => {
  it("defaults to fallback variant when rotation list is empty", () => {
    const controller = createVariantRotationController();
    expect(getCurrentVariant(controller)).toBe("badugi");
    expect(getNextVariant(controller)).toBeNull();
  });

  it("respects initial variant when provided", () => {
    const controller = createVariantRotationController({
      rotation: ["badugi", "nlh", "plo"],
      initialVariant: "nlh",
    });
    expect(getCurrentVariant(controller)).toBe("nlh");
    expect(getNextVariant(controller)).toBe("plo");
  });

  it("advances only when trigger matches policy", () => {
    const controller = createVariantRotationController({
      rotation: ["badugi", "nlh"],
      policy: "per-level",
    });
    const afterHandTrigger = advanceVariantRotation(controller, "hand");
    expect(getCurrentVariant(afterHandTrigger)).toBe("badugi");
    const afterLevelTrigger = advanceVariantRotation(controller, "level");
    expect(getCurrentVariant(afterLevelTrigger)).toBe("nlh");
  });

  it("wraps back to start after reaching the end of the sequence", () => {
    const base = createVariantRotationController({
      rotation: ["badugi", "nlh"],
      policy: "per-hand",
    });
    const next = advanceVariantRotation(base, "hand");
    expect(getCurrentVariant(next)).toBe("nlh");
    const wrapped = advanceVariantRotation(next, "hand");
    expect(getCurrentVariant(wrapped)).toBe("badugi");
  });
});
