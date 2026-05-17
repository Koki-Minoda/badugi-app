function visibleTestId(testId) {
  if (typeof document === "undefined") return false;
  const element = document.querySelector(`[data-testid="${testId}"]`);
  if (!element) return false;
  const box = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function interactableTestId(testId) {
  if (typeof document === "undefined") return false;
  const element = document.querySelector(`[data-testid="${testId}"]`);
  if (!element || !visibleTestId(testId)) return false;
  if (element.disabled || element.getAttribute("aria-disabled") === "true") return false;
  const box = element.getBoundingClientRect();
  if (box.bottom <= 0 || box.right <= 0 || box.left >= window.innerWidth || box.top >= window.innerHeight) {
    return false;
  }
  const x = Math.min(Math.max(box.left + box.width / 2, 0), window.innerWidth - 1);
  const y = Math.min(Math.max(box.top + box.height / 2, 0), window.innerHeight - 1);
  const topElement = document.elementFromPoint(x, y);
  return Boolean(topElement && (element === topElement || element.contains(topElement)));
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveActorSource(snapshot, phaseState, state) {
  if (typeof snapshot?.currentActor === "number") {
    return { source: "controller.currentActor", actor: snapshot.currentActor };
  }
  if (typeof snapshot?.turn === "number") {
    return { source: "controller.turn", actor: snapshot.turn };
  }
  if (typeof snapshot?.nextTurn === "number") {
    return { source: "controller.nextTurn", actor: snapshot.nextTurn };
  }
  if (typeof phaseState?.turn === "number") {
    return { source: "legacy.phaseState.turn", actor: phaseState.turn };
  }
  if (typeof state?.turn === "number") {
    return { source: "legacy.state.turn", actor: state.turn };
  }
  return { source: "none", actor: null };
}

export function buildSnapshotMergeSourceTrace(extra = {}) {
  if (typeof window === "undefined") return null;
  const api = window.__BADUGI_E2E__;
  const state = api?.getStateSnapshot?.() ?? null;
  const phaseState = api?.getPhaseState?.() ?? null;
  const snapshot = state?.controllerSnapshot ?? null;
  const actorSource = resolveActorSource(snapshot, phaseState, state);
  const visibleActions = [
    "action-check",
    "action-call",
    "action-raise",
    "action-fold",
    "action-draw-selected",
  ].filter(interactableTestId);
  const controllerPhase = snapshot?.phase ?? snapshot?.street ?? null;
  const mergedPhase = controllerPhase ?? phaseState?.phase ?? state?.phase ?? null;
  return {
    timestamp: Date.now(),
    variantId: state?.gameVariant ?? snapshot?.variantId ?? null,
    mode: document?.body?.dataset?.mode ?? null,
    label: extra.label ?? null,
    controller: {
      source: snapshot ? "state.controllerSnapshot" : "missing",
      actor: numberOrNull(snapshot?.currentActor ?? snapshot?.turn ?? snapshot?.nextTurn),
      phase: controllerPhase,
      drawRound: numberOrNull(snapshot?.drawRoundIndex ?? snapshot?.drawRound),
      betRound: numberOrNull(snapshot?.betRound ?? snapshot?.betRoundIndex),
    },
    session: {
      source: phaseState ? "phaseState" : "missing",
      actor: numberOrNull(phaseState?.turn),
      phase: phaseState?.phase ?? null,
      drawRound: numberOrNull(phaseState?.drawRound),
      betRound: numberOrNull(phaseState?.betRound),
    },
    legacy: {
      source: state ? "state" : "missing",
      actor: numberOrNull(state?.turn),
      phase: state?.phase ?? null,
      drawRound: numberOrNull(state?.drawRound),
      metadataActingPlayerIndex: numberOrNull(state?.metadata?.actingPlayerIndex),
    },
    metadata: {
      actingPlayerIndex: numberOrNull(snapshot?.metadata?.actingPlayerIndex ?? state?.metadata?.actingPlayerIndex),
    },
    mergedActor: actorSource.actor,
    mergedPhase,
    heroControlsReason: visibleActions.length
      ? `interactable:${visibleActions.join(",")}`
      : "no-interactable-hero-actions",
    actingBadgeReason: "not-exposed-in-current-dom",
    chosenSourcePriority: actorSource.source,
    ui: {
      visibleActions,
      heroControlsVisible: visibleActions.length > 0,
      displayedPhase: document.querySelector('[data-testid="table-phase-badge"]')?.textContent?.trim() ?? null,
      resultVisible: visibleTestId("hand-result-pot"),
      nextHandVisible: [...document.querySelectorAll("button")].some((button) =>
        /next hand/i.test(button.textContent ?? ""),
      ),
    },
  };
}

export function appendSnapshotMergeSourceTrace(extra = {}) {
  if (typeof window === "undefined") return null;
  const row = buildSnapshotMergeSourceTrace(extra);
  if (!row) return null;
  if (!Array.isArray(window.__MGX_SNAPSHOT_MERGE_SOURCE_TRACE__)) {
    window.__MGX_SNAPSHOT_MERGE_SOURCE_TRACE__ = [];
  }
  window.__MGX_SNAPSHOT_MERGE_SOURCE_TRACE__.push(row);
  return row;
}
