// src/ui/game/GameUIAdapterRegistry.js

const adapters = new Map();

export function registerGameUIAdapter(variantId, adapter) {
  if (!variantId || typeof variantId !== "string") {
    throw new Error("GameUIAdapterRegistry: variantId must be a non-empty string");
  }
  if (!adapter) {
    throw new Error(`GameUIAdapterRegistry: adapter for "${variantId}" is invalid`);
  }
  adapters.set(variantId, adapter);
}

export function getGameUIAdapter(variantId) {
  if (!variantId) return undefined;
  return adapters.get(variantId);
}

export function getRegisteredGameUIAdapters() {
  return Array.from(adapters.entries()).map(([variantId, adapter]) => ({
    variantId,
    adapter,
  }));
}

export function clearGameUIAdapters() {
  adapters.clear();
}
