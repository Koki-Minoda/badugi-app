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

  it("does not route an unrelated variant to a variant-specific tier model", () => {
    const entry = selectModelForVariant({ variantId: "UNKNOWN", tierId: "worldmaster" });
    expect(entry?.id).toBe("model-generic-v1");
  });

  it("uses exact variant-tier model before a generic tier model", () => {
    const entry = resolveTierModelInfo({ variantId: "D03", tierId: "beginner" });
    expect(entry?.modelId).toBe("model-generic-v1");

    const standard = resolveTierModelInfo({ variantId: "D03", tierId: "standard" });
    expect(standard?.modelId).toBe("model-badugi-standard-dqn-v3");

    const generic = resolveTierModelInfo({ variantId: "UNKNOWN", tierId: "beginner" });
    expect(generic?.modelId).toBe("model-generic-v1");
  });

  it("supports character-specific standard Badugi model overrides", () => {
    expect(selectModelForVariant({ variantId: "D03", tierId: "standard" })?.id).toBe(
      "model-badugi-standard-dqn-v3",
    );
    expect(
      selectModelForVariant({
        variantId: "D03",
        tierId: "standard",
        characterId: "badugi-standard-reader",
      })?.id,
    ).toBe("model-badugi-standard-dqn-v3");

    const characterModel = resolveCpuCharacterModelInfo({
      characterId: "badugi-standard-reader",
      variantId: "D03",
      tierId: "standard",
    });

    expect(characterModel).toMatchObject({
      characterId: "badugi-standard-reader",
      modelId: "model-badugi-standard-dqn-v3",
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
    })?.modelId).toBe("model-badugi-standard-dqn-v3");
  });

  it("does not route legacy beginner DQN to normal Badugi beginner CPU", () => {
    const legacy = getModelEntry("model-badugi-beginner-dqn-v1");
    expect(legacy?.trainingStatus).toBe("legacy");
    expect(legacy?.productionRequired).toBe(false);

    expect(selectModelForVariant({ variantId: "D03", tierId: "beginner" })?.id).not.toBe(
      "model-badugi-beginner-dqn-v1",
    );
  });

  it("routes 2-7 and A-5 draw beginner/standard tiers to trained draw DQN models", () => {
    expect(resolveTierModelInfo({ variantId: "D01", tierId: "beginner" })?.modelId).toBe(
      "model-27draw-beginner-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "D01", tierId: "standard" })?.modelId).toBe(
      "model-27draw-standard-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "S01", tierId: "standard" })?.modelId).toBe(
      "model-27draw-standard-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "D02", tierId: "beginner" })?.modelId).toBe(
      "model-a5draw-beginner-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "D02", tierId: "standard" })?.modelId).toBe(
      "model-a5draw-standard-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "S02", tierId: "standard" })?.modelId).toBe(
      "model-a5draw-standard-dqn-v1",
    );
  });

  it("routes NLH/FLH/PLO/PLO8 beginner and standard tiers to board DQN models", () => {
    expect(resolveTierModelInfo({ variantId: "B01", tierId: "beginner" })?.modelId).toBe(
      "model-nlh-beginner-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "B01", tierId: "standard" })?.modelId).toBe(
      "model-nlh-standard-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "B02", tierId: "beginner" })?.modelId).toBe(
      "model-flh-beginner-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "B02", tierId: "standard" })?.modelId).toBe(
      "model-flh-standard-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "B05", tierId: "beginner" })?.modelId).toBe(
      "model-plo-beginner-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "B05", tierId: "standard" })?.modelId).toBe(
      "model-plo-standard-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "B06", tierId: "beginner" })?.modelId).toBe(
      "model-plo8-beginner-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "B06", tierId: "standard" })?.modelId).toBe(
      "model-plo8-standard-dqn-v1",
    );
  });
});
