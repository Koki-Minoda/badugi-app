import { getModelEntry } from "../../ai/modelRouter.js";

const NON_DECISIONS = new Set(["blind", "ante", "collect"]);

export function findCompletedHandHistory({ current, buffer = [], handId }) {
  if (!handId) return null;
  if (current?.handId === handId) return current;
  return [...buffer].reverse().find((entry) => entry?.handId === handId) ?? null;
}

export function decisionProvenanceForHistory(metadata = {}) {
  const result = {};
  const source = metadata.drawInfo && typeof metadata.drawInfo === "object"
    ? metadata.drawInfo
    : metadata;
  for (const key of ["decisionSource", "modelId", "tierId", "fallbackReason"]) {
    const value = source[key] ?? metadata[key];
    if (typeof value === "string" && value) result[key] = value;
  }
  return result;
}

export function modelUsedBySeat({ actions = [], seat, variantId, tierId }) {
  const decisions = actions.filter((action) =>
    action?.seat === seat && !NON_DECISIONS.has(String(action?.type ?? "").toLowerCase()),
  );
  if (!decisions.length) return null;
  const actualIds = decisions.map((action) => {
    const metadata = action.metadata ?? {};
    return metadata.decisionSource === "onnx" ? metadata.modelId : null;
  });
  const modelId = actualIds[0];
  if (!modelId || actualIds.some((id) => id !== modelId)) return null;
  const entry = getModelEntry(modelId);
  return entry?.tier === tierId && entry.variantIds.includes(variantId) ? entry : null;
}

export function sharedModelUsedByHand(entries = []) {
  if (!entries.length || !entries[0]) return null;
  return entries.every((entry) => entry?.id === entries[0].id) ? entries[0] : null;
}
