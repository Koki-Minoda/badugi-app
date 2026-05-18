const DRAW_CONTROLLER_CLASS_PATTERN = /(?:D1|D2|S1|S2|DrawLowball|TripleDraw|SingleDraw)/i;

function normalizeVariant(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  const lower = raw.toLowerCase();
  if (["badugi", "d03"].includes(lower)) return "badugi";
  if (["d01", "deuce_to_seven_triple_draw", "27td"].includes(lower)) return "deuce_to_seven_triple_draw";
  if (["d02", "ace_to_five_triple_draw", "a5td"].includes(lower)) return "ace_to_five_triple_draw";
  if (["s01", "deuce_to_seven_single_draw", "27sd"].includes(lower)) return "deuce_to_seven_single_draw";
  if (["s02", "ace_to_five_single_draw", "a5sd"].includes(lower)) return "ace_to_five_single_draw";
  return lower;
}

function issue(type, severity, message, details = {}) {
  return { type, severity, message, ...details };
}

export function classifyCrossVariantStateLeak(audit = {}) {
  const violations = [];
  const currentVariant = normalizeVariant(
    audit.currentVariant ?? audit.gameVariant ?? audit.nextVariant ?? audit.variantId,
  );
  const controllerVariant = normalizeVariant(audit.controllerVariantRef ?? audit.gameControllerVariantId);
  const sessionVariant = normalizeVariant(audit.sessionVariantId);
  const snapshotVariant = normalizeVariant(
    audit.controllerSnapshotVariantId ?? audit.snapshotVariantId ?? audit.engineStateVariantId,
  );
  const previousVariant = normalizeVariant(audit.previousVariant);
  const previousHandId = audit.previousHandId ?? null;
  const newHandId = audit.newHandId ?? audit.handId ?? null;
  const controllerClass = audit.controllerClass ?? audit.gameControllerName ?? null;

  if (currentVariant && controllerVariant && controllerVariant !== currentVariant) {
    violations.push(
      issue("CROSS_VARIANT_CONTROLLER", "P0", "controller variant ref does not match active variant", {
        currentVariant,
        controllerVariant,
      }),
    );
  }

  if (currentVariant && sessionVariant && sessionVariant !== currentVariant) {
    violations.push(
      issue("CROSS_VARIANT_SESSION", "P0", "session controller variant does not match active variant", {
        currentVariant,
        sessionVariant,
      }),
    );
  }

  if (currentVariant && snapshotVariant && snapshotVariant !== currentVariant) {
    violations.push(
      issue("CROSS_VARIANT_SNAPSHOT", "P0", "controller snapshot variant does not match active variant", {
        currentVariant,
        snapshotVariant,
      }),
    );
  }

  if (
    currentVariant === "badugi" &&
    controllerClass &&
    DRAW_CONTROLLER_CLASS_PATTERN.test(controllerClass) &&
    controllerVariant !== "badugi"
  ) {
    violations.push(
      issue("CROSS_VARIANT_CONTROLLER_CLASS", "P0", "Badugi is using a draw-lowball controller class", {
        currentVariant,
        controllerClass,
        controllerVariant,
      }),
    );
  }

  if (previousVariant && currentVariant && previousVariant !== currentVariant && previousHandId && previousHandId === newHandId) {
    violations.push(
      issue("CROSS_VARIANT_HAND_ID", "P0", "new variant reused previous variant hand id", {
        previousVariant,
        currentVariant,
        handId: newHandId,
      }),
    );
  }

  return {
    status: violations.some((violation) => violation.severity === "P0") ? "FAIL" : "PASS",
    violations,
  };
}

export function assertNoCrossVariantStateLeak(audit = {}) {
  return classifyCrossVariantStateLeak(audit);
}

