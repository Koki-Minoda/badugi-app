import path from "node:path";

import { roundNumber, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";
import { buildLearningChartSeriesSummary } from "./buildLearningChartSeries.js";
import { buildLearningDashboardDataSummary } from "./buildLearningDashboardData.js";

export const DEFAULT_STEP57_PLOT_GROWTH_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step57-plot-growth-simulation.json",
);

function makeSessions(count) {
  return Array.from({ length: count }, (_, index) => {
    const variantId = index % 2 === 0 ? "S02" : "D02";
    return {
      sessionId: `step57-growth-${String(index + 1).padStart(2, "0")}`,
      variantId,
      actualDeltaPreview: index % 3 === 0 ? 8 : 4,
      evDeltaReviewed: variantId === "S02" ? 16 + index : 9 + index,
      lessonCount: 1,
      helpfulCount: index % 4 === 0 ? 0 : 1,
      replayViewedCount: variantId === "S02" ? 1 : index % 2,
      handsPlayed: 180,
    };
  });
}

function bridgeFromSessions(sessions = []) {
  const bySession = {};
  const bySessionVariant = {};
  sessions.forEach((session) => {
    bySession[session.sessionId] = { ...session, scope: "session", variantId: "mixed", gameMode: "tournament" };
    bySessionVariant[`${session.sessionId}|${session.variantId}`] = {
      ...session,
      scope: "session-variant",
      gameMode: "tournament",
    };
  });
  return { bySession, bySessionVariant, byVariant: { D02: {}, S02: {} } };
}

function totalsFor(sessions = []) {
  return {
    sessions: sessions.length,
    points: sessions.length,
    evReviewed: roundNumber(sessions.reduce((sum, session) => sum + session.evDeltaReviewed, 0), 4),
    lessonCount: sessions.reduce((sum, session) => sum + session.lessonCount, 0),
    handsPlayed: sessions.reduce((sum, session) => sum + session.handsPlayed, 0),
  };
}

function scenarioSummary(name, count) {
  const sessions = makeSessions(count);
  const dashboard = buildLearningDashboardDataSummary({ bridge: bridgeFromSessions(sessions), history: {}, recap: {}, telemetry: {} });
  const series = buildLearningChartSeriesSummary({ dashboard });
  return {
    scenario: name,
    ...totalsFor(sessions),
    finalEvReviewedPoint: series.global.evReviewedCumulative.at(-1)?.y ?? 0,
    finalLessonPoint: series.global.lessonCountCumulative.at(-1)?.y ?? 0,
  };
}

export function simulateDashboardPlotGrowthSummary() {
  const scenarios = [scenarioSummary("A", 4), scenarioSummary("B", 8), scenarioSummary("C", 12)];
  const [a, b, c] = scenarios;
  const pointsGrow = a.points < b.points && b.points < c.points;
  const evReviewedCumulativeGrows = a.evReviewed < b.evReviewed && b.evReviewed < c.evReviewed;
  const lessonCountCumulativeGrows = a.lessonCount < b.lessonCount && b.lessonCount < c.lessonCount;
  const handsPlayedGrows = a.handsPlayed < b.handsPlayed && b.handsPlayed < c.handsPlayed;
  const failures = [
    pointsGrow ? null : "points-not-growing",
    evReviewedCumulativeGrows ? null : "ev-reviewed-not-growing",
    lessonCountCumulativeGrows ? null : "lesson-count-not-growing",
    handsPlayedGrows ? null : "hands-played-not-growing",
  ].filter(Boolean);
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    scenarios,
    pointsGrow,
    evReviewedCumulativeGrows,
    lessonCountCumulativeGrows,
    handsPlayedGrows,
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function simulateDashboardPlotGrowth({
  outputPath = DEFAULT_STEP57_PLOT_GROWTH_OUTPUT_PATH,
} = {}) {
  return writeJsonReport(outputPath, simulateDashboardPlotGrowthSummary());
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await simulateDashboardPlotGrowth();
  console.log(JSON.stringify(report, null, 2));
}
