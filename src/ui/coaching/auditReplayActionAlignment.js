import path from "node:path";

import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP51_ALIGNMENT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step51-replay-action-alignment.json",
);

function norm(value = "") {
  return String(value ?? "").trim().toUpperCase();
}

function evaluateFixtureAlignment(fixture = {}) {
  const failures = [];
  const warnings = [];
  const action = fixture.actionAtIndex ?? null;
  const legalActions = new Set((fixture.sourceMetadata?.legalActions ?? []).map(norm));
  const recommended = norm(fixture.coaching?.recommendedAction);
  const baseline = norm(fixture.coaching?.baselineAction);

  if (!Number.isInteger(fixture.actionIndex)) failures.push("action-index-missing");
  if (!action) failures.push("action-row-missing");
  if (action && Number(action.seat) !== Number(fixture.actorSeat)) failures.push("actor-seat-mismatch");
  if (!legalActions.has(recommended)) failures.push("recommended-action-not-legal");
  if (!legalActions.has(baseline)) warnings.push("baseline-action-not-available");
  if (fixture.variantId !== "S02") failures.push("variant-mismatch");
  if (fixture.sourceMetadata?.stackDepth !== "deep") failures.push("stack-depth-mismatch");
  if (Number(fixture.sourceMetadata?.playerCount) !== Number(fixture.playerCount)) {
    failures.push("player-count-mismatch");
  }
  if (fixture.coaching?.replayDeterministic !== true) failures.push("replay-not-deterministic");

  return {
    lessonId: fixture.lessonId,
    actionIndex: fixture.actionIndex,
    actorSeat: fixture.actorSeat,
    actualAction: action?.action ?? null,
    recommendedAction: recommended,
    baselineAction: baseline,
    legalActions: [...legalActions],
    playerCount: fixture.playerCount,
    handClass: fixture.sourceMetadata?.handClass ?? null,
    failures,
    warnings,
    status: failures.length ? "FAIL" : warnings.length ? "WARN" : "PASS",
  };
}

export function auditReplayActionAlignmentSummary({ fixtureReport = {} } = {}) {
  const alignments = (fixtureReport.fixtures ?? []).map(evaluateFixtureAlignment);
  const status = alignments.some((entry) => entry.status === "FAIL")
    ? "FAIL"
    : alignments.some((entry) => entry.status === "WARN")
      ? "WARN"
      : "PASS";
  return {
    generatedAt: new Date().toISOString(),
    source: "step51-real-replay-coaching-fixture",
    status,
    alignments,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditReplayActionAlignment({
  fixturePath = path.resolve("reports/ai-iron/step51-real-replay-coaching-fixture.json"),
  outputPath = DEFAULT_STEP51_ALIGNMENT_OUTPUT_PATH,
  fixtureReport = null,
} = {}) {
  const report = auditReplayActionAlignmentSummary({
    fixtureReport: fixtureReport ?? (await readJson(fixturePath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditReplayActionAlignment();
  console.log(JSON.stringify(report, null, 2));
}
