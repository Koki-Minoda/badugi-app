import { assertActorInvariant } from "./assertActorInvariant.js";
import { assertActionReopenInvariant } from "./assertActionReopenInvariant.js";
import { assertBettingInvariant } from "./assertBettingInvariant.js";
import { assertDrawInvariant } from "./assertDrawInvariant.js";
import { assertPotInvariant } from "./assertPotInvariant.js";
import { assertSnapshotConsistencyInvariant } from "./assertSnapshotConsistencyInvariant.js";
import { assertTerminalInvariant } from "./assertTerminalInvariant.js";

export function createProgressionInvariantHarness(baseContext = {}) {
  const snapshots = [];
  const actionRows = [];
  const violations = [];

  function recordSnapshot(snapshot = {}, context = {}) {
    const merged = { ...baseContext, ...context, snapshot };
    snapshots.push({ snapshot, context: merged });
    violations.push(
      ...assertActorInvariant(snapshot, merged),
      ...assertBettingInvariant(snapshot, merged),
      ...assertPotInvariant(snapshot, merged),
      ...assertDrawInvariant(snapshot, merged),
      ...assertTerminalInvariant(snapshot, merged),
      ...assertSnapshotConsistencyInvariant(snapshot, merged),
    );
    return violations;
  }

  function recordAction(row = {}) {
    actionRows.push({ ...baseContext, ...row });
    return actionRows;
  }

  function finalize(context = {}) {
    violations.push(...assertActionReopenInvariant(actionRows, { ...baseContext, ...context }));
    return {
      status: violations.length === 0 ? "PASS" : "FAIL",
      snapshotsChecked: snapshots.length,
      actionsChecked: actionRows.length,
      violations,
      counts: summarizeViolations(violations),
    };
  }

  return { recordSnapshot, recordAction, finalize, snapshots, actionRows, violations };
}

export function summarizeViolations(violations = []) {
  const counts = {};
  for (const violation of violations) {
    counts[violation.type] = (counts[violation.type] ?? 0) + 1;
  }
  return counts;
}

