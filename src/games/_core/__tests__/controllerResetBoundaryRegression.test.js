import { describe, expect, it } from "vitest";
import { assertNoCrossVariantStateLeak } from "../../../ui/qa/assertNoCrossVariantStateLeak.js";

describe("controller reset boundary regression", () => {
  it("treats variant mismatch snapshots as a P0 leak", () => {
    const result = assertNoCrossVariantStateLeak({
      previousVariant: "D02",
      currentVariant: "badugi",
      controllerClass: "D2TripleDrawController",
      controllerVariantRef: "D02",
      controllerSnapshotVariantId: "D02",
      previousHandId: "D02-h9",
      handId: "D02-h9",
    });

    expect(result.status).toBe("FAIL");
    expect(result.violations.map((violation) => violation.type)).toEqual(
      expect.arrayContaining(["CROSS_VARIANT_CONTROLLER", "CROSS_VARIANT_SNAPSHOT", "CROSS_VARIANT_HAND_ID"]),
    );
  });

  it("accepts a mode switch when controller and snapshot variant match the active variant", () => {
    const result = assertNoCrossVariantStateLeak({
      previousVariant: "badugi",
      currentVariant: "D01",
      controllerClass: "D1TripleDrawController",
      controllerVariantRef: "D01",
      controllerSnapshotVariantId: "D01",
      previousHandId: "badugi-h4",
      handId: "D01-h1",
    });

    expect(result.status).toBe("PASS");
  });
});

