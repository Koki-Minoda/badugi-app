import { describe, expect, it } from "vitest";
import { resolveTierModelInfo } from "../tierManager.js";
import { getModelEntry, selectModelForVariant } from "../modelRouter.js";

describe("modelRouter", () => {
  it("resolves model by id", () => {
    const entry = getModelEntry("model-badugi-iron-v1");
    expect(entry?.onnx).toMatch(/badugi_iron_v1/);
  });

  it("selects model by variant first", () => {
    const entry = selectModelForVariant({ variantId: "D03" });
    expect(entry?.id).toBe("model-badugi-pro-v1");
  });

  it("falls back to tier match", () => {
    const entry = selectModelForVariant({ variantId: "UNKNOWN", tierId: "worldmaster" });
    expect(entry?.tier).toBe("worldmaster");
  });

  it("uses exact variant-tier model before a generic tier model", () => {
    const entry = resolveTierModelInfo({ variantId: "D03", tierId: "beginner" });
    expect(entry?.modelId).toBe("model-badugi-beginner-dqn-v1");

    const generic = resolveTierModelInfo({ variantId: "UNKNOWN", tierId: "beginner" });
    expect(generic?.modelId).toBe("model-generic-v1");
  });
});
