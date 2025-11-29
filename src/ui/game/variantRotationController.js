const DEFAULT_VARIANT = "badugi";
const VALID_POLICIES = new Set(["fixed", "per-level", "per-hand"]);

const normalizeVariantId = (value) => {
  if (!value && value !== 0) return "";
  return String(value).trim().toLowerCase();
};

const normalizeSequence = (rotation = [], fallbackVariant = DEFAULT_VARIANT) => {
  const sequence = Array.isArray(rotation) ? rotation : [];
  const normalized = sequence
    .map(normalizeVariantId)
    .filter((entry) => entry.length > 0);
  if (normalized.length > 0) {
    return normalized;
  }
  const fallback = normalizeVariantId(fallbackVariant);
  return fallback ? [fallback] : [DEFAULT_VARIANT];
};

export function createVariantRotationController({
  rotation = [],
  policy = "fixed",
  initialVariant,
  defaultVariant = DEFAULT_VARIANT,
} = {}) {
  const normalizedSequence = normalizeSequence(rotation, initialVariant ?? defaultVariant);
  const normalizedPolicy = VALID_POLICIES.has(policy) ? policy : "fixed";
  const desiredInitial = normalizeVariantId(
    initialVariant ?? rotation?.[0] ?? normalizedSequence[0],
  );
  const initialIndex = Math.max(
    0,
    normalizedSequence.indexOf(desiredInitial) !== -1
      ? normalizedSequence.indexOf(desiredInitial)
      : 0,
  );
  return {
    sequence: normalizedSequence,
    policy: normalizedPolicy,
    index: initialIndex,
  };
}

export function getCurrentVariant(controller) {
  if (!controller || !Array.isArray(controller.sequence)) return null;
  return controller.sequence[controller.index] ?? controller.sequence[0] ?? null;
}

export function getNextVariant(controller) {
  if (!controller || !Array.isArray(controller.sequence)) return null;
  if (controller.sequence.length <= 1) return null;
  const nextIndex = (controller.index + 1) % controller.sequence.length;
  return controller.sequence[nextIndex] ?? null;
}

export function advanceVariantRotation(controller, trigger) {
  if (!controller || !Array.isArray(controller.sequence) || controller.sequence.length <= 1) {
    return controller;
  }
  const policy = controller.policy ?? "fixed";
  const shouldRotate =
    (policy === "per-level" && trigger === "level") ||
    (policy === "per-hand" && trigger === "hand");
  if (!shouldRotate) {
    return controller;
  }
  const nextIndex = (controller.index + 1) % controller.sequence.length;
  if (nextIndex === controller.index) {
    return controller;
  }
  return {
    ...controller,
    index: nextIndex,
  };
}
