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
    expect(entry?.modelId).toBe("model-badugi-sixmax-standard-dqn-v2");

    const standard = resolveTierModelInfo({ variantId: "D03", tierId: "standard" });
    expect(standard?.modelId).toBe("model-badugi-sixmax-standard-e11");

    const generic = resolveTierModelInfo({ variantId: "UNKNOWN", tierId: "beginner" });
    expect(generic?.modelId).toBe("model-generic-v1");
  });

  it("supports character-specific standard Badugi model overrides", () => {
    expect(selectModelForVariant({ variantId: "D03", tierId: "standard" })?.id).toBe(
      "model-badugi-sixmax-standard-e11",
    );
    expect(
      selectModelForVariant({
        variantId: "D03",
        tierId: "standard",
        characterId: "badugi-sixmax-standard-ryo",
      })?.id,
    ).toBe("model-badugi-sixmax-standard-e11");

    const characterModel = resolveCpuCharacterModelInfo({
      characterId: "badugi-sixmax-standard-ryo",
      variantId: "D03",
      tierId: "standard",
    });

    expect(characterModel).toMatchObject({
      characterId: "badugi-sixmax-standard-ryo",
      characterLabel: "Ryo",
      modelId: "model-badugi-sixmax-standard-e11",
      tierId: "standard",
      style: "profile-diverse",
    });
  });

  it("uses E11 as the shared Badugi Standard base while preserving character styles", () => {
    expect(getModelEntry("model-badugi-sixmax-standard-e11")).toMatchObject({
      tier: "standard",
      variantIds: ["D03"],
      onnx: "models/badugi_sixmax_standard_e11.onnx",
      sourceCheckpoint:
        "rl/models/badugi_phase4_20260828/e11_epsilon_005_3k/badugi_sixmax_dqn_0003000_20260828-211540.pt",
      productionRequired: true,
    });

    expect(resolveTierModelInfo({ variantId: "D03", tierId: "standard" })).toMatchObject({
      modelId: "model-badugi-sixmax-standard-e11",
      tierId: "standard",
    });

    expect(resolveCpuCharacterModelInfo({
      characterId: "badugi-standard-reader",
      variantId: "D03",
      tierId: "standard",
    })).toMatchObject({
      characterLabel: "Reading Standard",
      modelId: "model-badugi-sixmax-standard-e11",
      style: "opponent-reading",
    });

    expect(resolveCpuCharacterModelInfo({
      characterId: "badugi-standard-balanced",
      variantId: "D03",
      tierId: "standard",
    })).toMatchObject({
      characterLabel: "Balanced Standard",
      modelId: "model-badugi-sixmax-standard-e11",
      style: "baseline-balanced",
    });

    for (const [characterId, characterLabel, style] of [
      ["akira", "Akira", "balanced"],
      ["mina", "Mina", "tight-aggressive"],
      ["ryo", "Ryo", "pat-pressure"],
      ["emi", "Emi", "passive-punisher"],
    ]) {
      expect(resolveCpuCharacterModelInfo({
        characterId,
        variantId: "D03",
        tierId: "standard",
      })).toMatchObject({
        characterId,
        characterLabel,
        personality: characterLabel,
        modelId: "model-badugi-sixmax-standard-e11",
        tierId: "standard",
        style,
      });
    }
  });

  it("does not route older standard models to normal Badugi standard CPU", () => {
    const legacy = getModelEntry("model-badugi-standard-dqn-v1");
    expect(legacy?.trainingStatus).toBe("legacy");
    expect(legacy?.productionRequired).toBe(false);
    expect(getModelEntry("model-badugi-sixmax-standard-1m")).toMatchObject({
      tier: "standard",
      productionRequired: true,
    });

    expect(resolveCpuCharacterModelInfo({
      characterId: "badugi-sixmax-standard-ryo",
      variantId: "D03",
      tierId: "standard",
    })?.modelId).toBe("model-badugi-sixmax-standard-e11");
  });

  it("routes the former Standard v2 as Beginner and keeps legacy beginner assets offline", () => {
    const legacy = getModelEntry("model-badugi-beginner-dqn-v1");
    expect(legacy?.trainingStatus).toBe("legacy");
    expect(legacy?.productionRequired).toBe(false);

    expect(selectModelForVariant({ variantId: "D03", tierId: "beginner" })?.id).toBe(
      "model-badugi-sixmax-standard-dqn-v2",
    );
    expect(getModelEntry("model-badugi-sixmax-standard-dqn-v2")).toMatchObject({
      tier: "beginner",
      trainingStatus: "active-beginner-demoted",
    });
  });

  it("routes Badugi Beginner to the former Standard without changing stronger tiers", () => {
    expect(resolveTierModelInfo({ variantId: "D03", tierId: "beginner" })).toMatchObject({
      modelId: "model-badugi-sixmax-standard-dqn-v2",
      tierId: "beginner",
      variantIds: ["D03"],
      onnx: "models/badugi_sixmax_standard_dqn_v2.onnx",
      inputShape: [96],
      outputShape: [6],
    });
    expect(resolveTierModelInfo({ variantId: "D03", tierId: "standard" })?.modelId).toBe(
      "model-badugi-sixmax-standard-e11",
    );
    expect(resolveTierModelInfo({ variantId: "D03", tierId: "pro" })?.modelId).toBe(
      "model-badugi-pro-v1",
    );
    expect(resolveTierModelInfo({ variantId: "D03", tierId: "iron" })?.modelId).toBe(
      "model-badugi-iron-v1",
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
    expect(resolveTierModelInfo({ variantId: "D01", tierId: "pro" })?.modelId).toBe(
      "model-d01-td-pro-dqn-025000",
    );
    expect(resolveTierModelInfo({ variantId: "S01", tierId: "pro" })?.modelId).toBe(
      "model-27draw-pro-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "D01", tierId: "iron" })?.modelId).toBe(
      "model-27draw-iron-v1",
    );
    expect(resolveTierModelInfo({ variantId: "D02", tierId: "beginner" })?.modelId).toBe(
      "model-a5draw-beginner-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "D02", tierId: "standard" })?.modelId).toBe(
      "model-a5draw-standard-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "D02", tierId: "pro" })?.modelId).toBe(
      "model-a5draw-pro-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "S02", tierId: "pro" })?.modelId).toBe(
      "model-s02-sd-pro-dqn-v2-025000",
    );
    expect(resolveTierModelInfo({ variantId: "S02", tierId: "pro" })).toMatchObject({
      tierId: "pro",
      variantIds: ["S02"],
      onnx: "models/s02_sd_pro_dqn_v2_025000.onnx",
      inputShape: [96],
      outputShape: [11],
    });
    expect(getModelEntry("model-s02-sd-pro-dqn-v2-025000")).toMatchObject({
      variantId: "S02",
      family: "low-a5",
      maxDraws: 1,
      tier: "pro",
      activeTier: "pro",
      ironPassed: true,
      sourceCheckpoint:
        "rl/models/draw/s02_sd_v2_25k/low-a5_selfplay_dqn_020000_20260603-191333.pt",
      gateReport: "reports/ai-eval/draw-lowball-gate-S02-pro-25k-v2-20260603-rerun.json",
    });
    expect(getModelEntry("model-d01-td-pro-dqn-025000")).toMatchObject({
      variantId: "D01",
      variantIds: ["D01"],
      family: "low-27",
      maxDraws: 3,
      tier: "pro",
      activeTier: "pro",
      ironPassed: true,
      onnx: "models/d01_td_pro_dqn_025000.onnx",
      sourceCheckpoint:
        "rl/models/draw/d01_local_25k/low-27_selfplay_dqn_025000_20260604-012200.pt",
      gateReport: "reports/ai-eval/draw-lowball-gate-D01-pro-local-25k-20260604.json",
    });
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

  it("routes Stud/Razz beginner and standard tiers to bootstrap Stud DQN models", () => {
    expect(resolveTierModelInfo({ variantId: "ST1", tierId: "beginner" })?.modelId).toBe(
      "model-stud-beginner-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "ST1", tierId: "standard" })?.modelId).toBe(
      "model-stud-standard-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "ST2", tierId: "beginner" })?.modelId).toBe(
      "model-stud8-beginner-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "ST2", tierId: "standard" })?.modelId).toBe(
      "model-stud8-standard-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "ST3", tierId: "beginner" })?.modelId).toBe(
      "model-razz-beginner-dqn-v1",
    );
    expect(resolveTierModelInfo({ variantId: "ST3", tierId: "standard" })?.modelId).toBe(
      "model-razz-standard-dqn-v1",
    );
  });
});
