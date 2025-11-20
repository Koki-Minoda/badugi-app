import { describe, expect, it } from "vitest";
import { getModelEntry, selectModelForVariant } from "../modelRouter.js";

describe("modelRouter", () => {
  it("resolves model by id", () => {
    const entry = getModelEntry("model-badugi-v2");
    expect(entry?.onnx).toMatch(/badugi_iron/);
  });

  it("selects model by variant first", () => {
    const entry = selectModelForVariant({ variantId: "D03" });
    expect(entry?.id).toBe("model-badugi-v2");
  });

  it("falls back to tier match", () => {
    const entry = selectModelForVariant({ variantId: "UNKNOWN", tierId: "worldmaster" });
    expect(entry?.tier).toBe("worldmaster");
  });
});
