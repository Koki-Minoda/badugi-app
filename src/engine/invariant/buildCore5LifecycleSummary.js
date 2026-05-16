export function buildCore5LifecycleSummary(rows = []) {
  const totals = {
    handsSimulated: 0,
    sessionsCompleted: 0,
    tournamentsCompleted: 0,
    invariantViolations: 0,
    actorMismatches: 0,
    actionReopenFailures: 0,
    potFailures: 0,
    terminalFailures: 0,
    cashOutFailures: 0,
    heroBustFailures: 0,
    cpuBustFailures: 0,
    championFailures: 0,
    feedbackFailures: 0,
    menuReturnFailures: 0,
    freezes: 0,
  };
  for (const row of rows) {
    totals.handsSimulated += Number(row.handsSimulated ?? row.handsCompleted ?? 0);
    totals.sessionsCompleted += Number(row.sessionsCompleted ?? 0);
    totals.tournamentsCompleted += Number(row.tournamentsCompleted ?? 0);
    totals.invariantViolations += Number(row.invariantViolations ?? 0);
    totals.actorMismatches += Number(row.actorMismatches ?? 0);
    totals.actionReopenFailures += Number(row.actionReopenFailures ?? 0);
    totals.potFailures += Number(row.potFailures ?? 0);
    totals.terminalFailures += Number(row.terminalFailures ?? 0);
    totals.cashOutFailures += Number(row.cashOutFailures ?? 0);
    totals.heroBustFailures += Number(row.heroBustFailures ?? 0);
    totals.cpuBustFailures += Number(row.cpuBustFailures ?? 0);
    totals.championFailures += Number(row.championFailures ?? 0);
    totals.feedbackFailures += Number(row.feedbackFailures ?? 0);
    totals.menuReturnFailures += Number(row.menuReturnFailures ?? 0);
    totals.freezes += Number(row.freezes ?? 0);
  }
  return {
    generatedAt: new Date().toISOString(),
    status: totals.invariantViolations === 0 ? "PASS" : "FAIL",
    totals,
    rows,
  };
}

