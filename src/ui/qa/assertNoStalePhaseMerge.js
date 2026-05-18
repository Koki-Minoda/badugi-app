function issue(type, severity, message, details = {}) {
  return { type, severity, message, ...details };
}

function normalizePhase(value) {
  if (value == null) return null;
  const phase = String(value).toUpperCase();
  if (phase === "COMPLETE" || phase === "TERMINAL") return "RESULT";
  if (phase === "WAITING_NEXT_HAND") return "NEXT_HAND";
  return phase;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function assertNoStalePhaseMerge(row = {}) {
  const violations = [];
  const merge = row.mergeSource ?? {};
  const controller = merge.controller ?? {};
  const session = merge.session ?? {};
  const legacy = merge.legacy ?? {};
  const controllerPhase = normalizePhase(controller.phase);
  const mergedPhase = normalizePhase(merge.mergedPhase ?? row.phase);
  const displayedPhase = normalizePhase(row.ui?.displayedPhase);

  if (controller.source !== "missing" && controllerPhase && mergedPhase && controllerPhase !== mergedPhase) {
    violations.push(
      issue("STALE_PHASE_MERGE", "P0", "merged phase does not match controller snapshot phase", {
        controllerPhase,
        mergedPhase,
        chosenSourcePriority: merge.chosenSourcePriority,
      }),
    );
  }

  if (
    controller.source !== "missing" &&
    typeof controller.actor === "number" &&
    typeof merge.mergedActor === "number" &&
    controller.actor !== merge.mergedActor
  ) {
    violations.push(
      issue("STALE_PHASE_MERGE", "P0", "merged actor does not match controller snapshot actor", {
        controllerActor: controller.actor,
        mergedActor: merge.mergedActor,
        chosenSourcePriority: merge.chosenSourcePriority,
      }),
    );
  }

  const controllerDraw = numberOrNull(controller.drawRound);
  const sessionDraw = numberOrNull(session.drawRound);
  const legacyDraw = numberOrNull(legacy.drawRound);
  if (controllerDraw !== null && sessionDraw !== null && controllerDraw !== sessionDraw && !displayedPhase?.includes("RESULT")) {
    violations.push(
      issue("STALE_PHASE_MERGE", "P0", "session draw round diverges from controller draw round", {
        controllerDraw,
        sessionDraw,
      }),
    );
  }
  if (controllerDraw !== null && legacyDraw !== null && controllerDraw !== legacyDraw && !displayedPhase?.includes("RESULT")) {
    violations.push(
      issue("STALE_PHASE_MERGE", "P0", "legacy draw round diverges from controller draw round", {
        controllerDraw,
        legacyDraw,
      }),
    );
  }

  return {
    status: violations.some((violation) => violation.severity === "P0") ? "FAIL" : violations.length ? "WARN" : "PASS",
    violations,
  };
}

export default assertNoStalePhaseMerge;
