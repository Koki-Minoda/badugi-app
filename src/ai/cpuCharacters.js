import cpuCharacters from "../config/ai/cpuCharacters.json";
import { getModelEntry, selectModelForVariant } from "./modelRouter.js";

const CHARACTERS = cpuCharacters.map((character) =>
  Object.freeze({
    ...character,
    variantIds: Array.isArray(character.variantIds) ? character.variantIds : [],
  }),
);

export function listCpuCharacters({ variantId, tierId } = {}) {
  return CHARACTERS.filter((character) => {
    if (variantId && character.variantIds.length > 0 && !character.variantIds.includes(variantId)) {
      return false;
    }
    if (tierId && character.tierId !== tierId) {
      return false;
    }
    return true;
  });
}

export function getCpuCharacter(characterId) {
  return CHARACTERS.find((character) => character.id === characterId) ?? null;
}

export function resolveCpuCharacterModelInfo({ characterId, variantId, tierId } = {}) {
  const character = getCpuCharacter(characterId);
  if (!character) {
    return selectModelForVariant({ variantId, tierId }) ?? null;
  }
  const entry =
    (character.modelId ? getModelEntry(character.modelId) : null) ??
    selectModelForVariant({
      variantId,
      tierId: character.tierId ?? tierId,
      characterId: character.id,
    });
  if (!entry) return null;
  return {
    characterId: character.id,
    characterLabel: character.label,
    modelId: entry.id,
    tierId: entry.tier,
    variantIds: entry.variantIds,
    onnx: entry.onnx,
    inputShape: entry.inputShape,
    outputShape: entry.outputShape,
  };
}
