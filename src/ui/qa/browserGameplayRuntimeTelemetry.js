import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

function emptyCounts() {
  return {
    raises: 0,
    calls: 0,
    checks: 0,
    folds: 0,
    draws: 0,
    reRaises: 0,
  };
}

function maxBy(items, field) {
  return items.reduce((max, item) => Math.max(max, Number(item?.[field] ?? 0)), 0);
}

function percentile(items, field, pct) {
  const values = items.map((item) => Number(item?.[field] ?? 0)).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil((pct / 100) * values.length) - 1));
  return values[index];
}

function safeRate(count, elapsedMs) {
  return elapsedMs > 0 ? count / (elapsedMs / 1000) : 0;
}

export function createBrowserGameplayRuntimeTelemetry({
  variantId,
  mode,
  viewport,
  handsTarget,
  traceMode = "normal",
} = {}) {
  const startedAt = performance.now();
  const hands = [];
  const actions = [];
  const transitions = [];
  const actionCounts = emptyCounts();
  const waitStats = { totalMs: 0, count: 0, byReason: {} };
  const domStats = { queryCount: 0 };
  const snapshotStats = { collectionCount: 0 };
  const assertionStats = { count: 0, violationCount: 0, p0Count: 0, byType: {} };
  const traceStats = { writeCount: 0, rowCount: 0, bytes: 0, totalWriteMs: 0 };
  const screenshotStats = { count: 0, totalMs: 0 };
  const clickStats = { successful: 0, failed: 0 };
  const idleStats = { loopCount: 0, maxIdleMs: 0, lastProgressAt: startedAt, lastProgressKey: null };

  let currentHand = null;

  function ensureHand(handIndex, progress = {}) {
    const handId = progress?.handId ?? `hand-${handIndex}`;
    if (!currentHand || currentHand.index !== handIndex || currentHand.handId !== handId) {
      if (currentHand && currentHand.completedAt == null) {
        currentHand.lastSeenAt = performance.now();
      }
      currentHand = {
        index: handIndex,
        handId,
        startedAt: performance.now(),
        completedAt: null,
        actionCount: 0,
        drawDecisionCount: 0,
        lastProgressKey: null,
        maxIdleMs: 0,
      };
      hands.push(currentHand);
    }
    return currentHand;
  }

  function recordProgress(key) {
    const now = performance.now();
    if (key && idleStats.lastProgressKey && key === idleStats.lastProgressKey) {
      const idleMs = now - idleStats.lastProgressAt;
      idleStats.loopCount += 1;
      idleStats.maxIdleMs = Math.max(idleStats.maxIdleMs, idleMs);
      if (currentHand) currentHand.maxIdleMs = Math.max(currentHand.maxIdleMs, idleMs);
      return false;
    }
    idleStats.lastProgressKey = key ?? null;
    idleStats.lastProgressAt = now;
    return true;
  }

  function startAction({ handIndex, step, progress, payload }) {
    const hand = ensureHand(handIndex, progress);
    return {
      handIndex,
      handId: hand.handId,
      step,
      phase: progress?.phase ?? null,
      drawRound: progress?.drawRoundIndex ?? null,
      betRound: progress?.snapshot?.betRound ?? progress?.phaseState?.betRound ?? null,
      actor: progress?.actor ?? null,
      payload,
      startedAt: performance.now(),
      waitMs: 0,
      retryCount: 0,
    };
  }

  function endAction(token, result = {}) {
    const now = performance.now();
    const payloadType = result?.payload?.type ?? token?.payload?.type ?? "unknown";
    const elapsedMs = now - Number(token?.startedAt ?? now);
    const row = {
      handIndex: token?.handIndex ?? null,
      handId: token?.handId ?? null,
      step: token?.step ?? null,
      phase: token?.phase ?? null,
      drawRound: token?.drawRound ?? null,
      betRound: token?.betRound ?? null,
      actor: token?.actor ?? null,
      actionType: payloadType,
      clickedAction: result?.clickedAction ?? null,
      elapsedMs,
      waitMs: Number(token?.waitMs ?? 0),
      retryCount: Number(token?.retryCount ?? 0),
      success: Boolean(result?.acted),
    };
    actions.push(row);
    if (currentHand) {
      currentHand.actionCount += 1;
      if (payloadType === "draw") currentHand.drawDecisionCount += 1;
    }
    if (payloadType === "raise") actionCounts.raises += 1;
    if (payloadType === "call") actionCounts.calls += 1;
    if (payloadType === "check") actionCounts.checks += 1;
    if (payloadType === "fold") actionCounts.folds += 1;
    if (payloadType === "draw") actionCounts.draws += 1;
    if (result?.clickedAction && String(result.clickedAction).includes("re-raise")) actionCounts.reRaises += 1;
    if (result?.acted) clickStats.successful += 1;
    else clickStats.failed += 1;
    return row;
  }

  function completeHand(handIndex, progress = {}) {
    const hand = ensureHand(handIndex, progress);
    hand.completedAt = performance.now();
    hand.elapsedMs = hand.completedAt - hand.startedAt;
  }

  function recordWait(ms, reason = "unknown") {
    const value = Math.max(0, Number(ms ?? 0));
    waitStats.totalMs += value;
    waitStats.count += 1;
    waitStats.byReason[reason] = (waitStats.byReason[reason] ?? 0) + value;
  }

  function recordTransition(ms, reason = "progress") {
    transitions.push({ reason, elapsedMs: Math.max(0, Number(ms ?? 0)) });
  }

  function recordDomQuery(count = 1) {
    domStats.queryCount += Math.max(0, Number(count ?? 0));
  }

  function recordSnapshot(count = 1) {
    snapshotStats.collectionCount += Math.max(0, Number(count ?? 0));
  }

  function recordAssertion(violations = []) {
    assertionStats.count += 1;
    assertionStats.violationCount += violations.length;
    for (const violation of violations) {
      assertionStats.byType[violation.type] = (assertionStats.byType[violation.type] ?? 0) + 1;
      if (violation.severity === "P0") assertionStats.p0Count += 1;
    }
  }

  function recordTraceWrite({ rows = 0, bytes = 0, elapsedMs = 0 } = {}) {
    traceStats.writeCount += 1;
    traceStats.rowCount += Math.max(0, Number(rows ?? 0));
    traceStats.bytes += Math.max(0, Number(bytes ?? 0));
    traceStats.totalWriteMs += Math.max(0, Number(elapsedMs ?? 0));
  }

  function recordScreenshot(ms = 0) {
    screenshotStats.count += 1;
    screenshotStats.totalMs += Math.max(0, Number(ms ?? 0));
  }

  function summary(extra = {}) {
    const endedAt = performance.now();
    const elapsedMs = endedAt - startedAt;
    const completedHands = hands.filter((hand) => hand.completedAt != null);
    const handDurations = completedHands.map((hand) => ({ elapsedMs: hand.elapsedMs ?? 0 }));
    const longestHand = [...hands].sort((a, b) => Number(b.elapsedMs ?? b.maxIdleMs ?? 0) - Number(a.elapsedMs ?? a.maxIdleMs ?? 0))[0] ?? null;
    const longestAction = [...actions].sort((a, b) => b.elapsedMs - a.elapsedMs)[0] ?? null;
    const base = {
      variantId,
      mode,
      viewport,
      handsTarget,
      traceMode,
      totalElapsedMs: elapsedMs,
      handsAttempted: hands.length,
      handsCompleted: completedHands.length,
      handCompletionRate: handsTarget ? completedHands.length / Number(handsTarget) : 0,
      actionsObserved: actions.length,
      actionsPerSecond: safeRate(actions.length, elapsedMs),
      handsPerSecond: safeRate(completedHands.length, elapsedMs),
      perHandElapsedMs: {
        p50: percentile(handDurations, "elapsedMs", 50),
        p95: percentile(handDurations, "elapsedMs", 95),
        max: maxBy(handDurations, "elapsedMs"),
      },
      perActionElapsedMs: {
        p50: percentile(actions, "elapsedMs", 50),
        p95: percentile(actions, "elapsedMs", 95),
        max: maxBy(actions, "elapsedMs"),
      },
      perTransitionElapsedMs: {
        p50: percentile(transitions, "elapsedMs", 50),
        p95: percentile(transitions, "elapsedMs", 95),
        max: maxBy(transitions, "elapsedMs"),
      },
      retryCountTotal: actions.reduce((sum, action) => sum + Number(action.retryCount ?? 0), 0),
      waitTimeMsTotal: waitStats.totalMs,
      waitTimeByReasonMs: waitStats.byReason,
      domQueryCount: domStats.queryCount,
      snapshotCollectionCount: snapshotStats.collectionCount,
      invariantAssertionCount: assertionStats.count,
      invariantViolationCount: assertionStats.violationCount,
      invariantP0Count: assertionStats.p0Count,
      invariantViolationsByType: assertionStats.byType,
      traceWriteCount: traceStats.writeCount,
      traceRowsWritten: traceStats.rowCount,
      traceBytesWritten: traceStats.bytes,
      traceWriteMsTotal: traceStats.totalWriteMs,
      screenshotCount: screenshotStats.count,
      screenshotMsTotal: screenshotStats.totalMs,
      failedClickCount: clickStats.failed,
      successfulClickCount: clickStats.successful,
      idleLoopCount: idleStats.loopCount,
      maxIdleDurationMs: idleStats.maxIdleMs,
      longestHand,
      longestAction,
      actionCounts,
      drawDecisionsPerHand: completedHands.length ? actionCounts.draws / completedHands.length : 0,
      ...extra,
    };
    return { ...base, classification: classifyBrowserGameplayRuntime(base) };
  }

  return {
    startAction,
    endAction,
    completeHand,
    recordProgress,
    recordWait,
    recordTransition,
    recordDomQuery,
    recordSnapshot,
    recordAssertion,
    recordTraceWrite,
    recordScreenshot,
    summary,
  };
}

export function classifyBrowserGameplayRuntime(summary = {}) {
  if (Number(summary.invariantP0Count ?? 0) > 0 || Number(summary.failedClickCount ?? 0) > 0) {
    return "REAL_FREEZE_OR_ACTION_FAILURE";
  }
  if (Number(summary.handsCompleted ?? 0) <= 0 && Number(summary.maxIdleDurationMs ?? 0) > 30000) {
    return "REAL_FREEZE";
  }
  if (Number(summary.maxIdleDurationMs ?? 0) > 45000 && Number(summary.handsCompleted ?? 0) < Number(summary.handsTarget ?? 0)) {
    return "REAL_FREEZE";
  }
  if (Number(summary.retryCountTotal ?? 0) > Math.max(50, Number(summary.actionsObserved ?? 0) * 2)) {
    return "EXCESSIVE_RETRY";
  }
  if (Number(summary.idleLoopCount ?? 0) > Math.max(200, Number(summary.actionsObserved ?? 0) * 5)) {
    return "PROGRESS_HELPER_HOT_LOOP";
  }
  if (Number(summary.traceWriteMsTotal ?? 0) > Number(summary.totalElapsedMs ?? 0) * 0.2) {
    return "TRACE_OVERHEAD";
  }
  if (Number(summary.invariantAssertionCount ?? 0) > Math.max(500, Number(summary.actionsObserved ?? 0) * 8)) {
    return "ASSERTION_OVERHEAD";
  }
  if (
    Number(summary.handsCompleted ?? 0) > 0 &&
    Number(summary.handsCompleted ?? 0) < Number(summary.handsTarget ?? 0) &&
    Number(summary.invariantP0Count ?? 0) === 0
  ) {
    return "PLAYWRIGHT_TIMEOUT_ONLY";
  }
  if (Number(summary.handsCompleted ?? 0) >= Number(summary.handsTarget ?? 0) && Number(summary.invariantP0Count ?? 0) === 0) {
    return "SLOW_PROGRESS";
  }
  return "UNKNOWN";
}

export function writeBrowserGameplayRuntimeTelemetry(filePath, payload) {
  const started = performance.now();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  fs.writeFileSync(filePath, content);
  return { bytes: Buffer.byteLength(content), elapsedMs: performance.now() - started };
}
