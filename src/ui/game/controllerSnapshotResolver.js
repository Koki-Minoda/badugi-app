export function resolveEffectiveControllerSnapshot({
  sessionController,
  sessionState,
  candidates = [],
  variantId,
  matchesVariant,
  warn = console.warn,
} = {}) {
  if (typeof matchesVariant !== "function") {
    throw new TypeError("matchesVariant is required");
  }

  try {
    if (
      sessionController &&
      sessionState &&
      typeof sessionController.getUiSnapshot === "function"
    ) {
      const snapshot = sessionController.getUiSnapshot(sessionState);
      if (snapshot?.phase !== "IDLE" && matchesVariant(snapshot, variantId)) {
        return snapshot;
      }
    }
  } catch (error) {
    warn("[UI-ADAPTER] session controller snapshot failed", error);
  }

  return candidates.find((snapshot) => matchesVariant(snapshot, variantId)) ?? null;
}
