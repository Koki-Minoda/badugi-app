import { describe, expect, it } from "vitest";
import { resolveCpuCharacterModelInfo } from "../cpuCharacters.js";
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
    expect(entry?.modelId).toBe("model-generic-v1");

    const standard = resolveTierModelInfo({ variantId: "D03", tierId: "standard" });
    expect(standard?.modelId).toBe("model-badugi-standard-dqn-v2");

    const generic = resolveTierModelInfo({ variantId: "UNKNOWN", tierId: "beginner" });
    expect(generic?.modelId).toBe("model-generic-v1");
  });

  it("supports character-specific standard Badugi model overrides", () => {
    expect(selectModelForVariant({ variantId: "D03", tierId: "standard" })?.id).toBe(
      "model-badugi-standard-dqn-v2",
    );
    expect(
      selectModelForVariant({
        variantId: "D03",
        tierId: "standard",
        characterId: "badugi-standard-reader",
      })?.id,
    ).toBe("model-badugi-standard-dqn-v2");

    const characterModel = resolveCpuCharacterModelInfo({
      characterId: "badugi-standard-reader",
      variantId: "D03",
      tierId: "standard",
    });

    expect(characterModel).toMatchObject({
      characterId: "badugi-standard-reader",
      modelId: "model-badugi-standard-dqn-v2",
      tierId: "standard",
    });
  });

  it("does not route legacy standard models to normal Badugi standard CPU", () => {
    const legacy = getModelEntry("model-badugi-standard-dqn-v1");
    expect(legacy?.trainingStatus).toBe("legacy");
    expect(legacy?.productionRequired).toBe(false);

    expect(resolveCpuCharacterModelInfo({
      characterId: "badugi-standard-balanced",
      variantId: "D03",
      tierId: "standard",
    })?.modelId).toBe("model-badugi-standard-dqn-v2");
  });

  it("does not route legacy beginner DQN to normal Badugi beginner CPU", () => {
    const legacy = getModelEntry("model-badugi-beginner-dqn-v1");
    expect(legacy?.trainingStatus).toBe("legacy");
    expect(legacy?.productionRequired).toBe(false);

    expect(selectModelForVariant({ variantId: "D03", tierId: "beginner" })?.id).not.toBe(
      "model-badugi-beginner-dqn-v1",
    );
  });
});
