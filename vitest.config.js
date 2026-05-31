import { defineConfig } from "vitest/config";

const BASE_EXCLUDE = [
  "node_modules",
  "dist",
  "e2e/**",
  "tests/e2e/**",
  "tests/badugi-regression/**",
];

const TIER2_UI_TESTS = [
  "src/ui/coaching/**/*.{test,spec}.{js,jsx,ts,tsx}",
  "src/ui/components/__tests__/{CoachingRecapPanel,CoachingRecapPanel.variantFilter,CoachingSummaryPanel,LearningDashboardPreview,ReplayCoachingOverlay,TournamentResultOverlay.coaching,TournamentResultOverlay}.test.jsx",
  "src/ui/feedback/**/*.{test,spec}.{js,jsx,ts,tsx}",
  "src/ui/screens/__tests__/{FriendMatchSetupScreen,HandHistoryScreen,HistoryScreen,LearningDashboardPreviewScreen,ReplayScreen,ReplayScreen.coachingRealFixture,ReplayScreen.review}.test.jsx",
  "src/ui/tournament/**/*.{test,spec}.{js,jsx,ts,tsx}",
];

const TIER3_EVALUATION_TESTS = [
  "src/ai/evaluation/__tests__/{actionDivergence,actionValueDataset,auditReplayDeterminismCliRunner,counterfactualReplay,exportActionValueDatasetCliRunner,proEvaluationBatch,replayDeterminism,runCounterfactualDivergenceScoreCli,runCounterfactualDivergenceScoreCliRunner,runProVsStandardEvaluationCli}.test.js",
];

const TIER3_REPORT_DEPENDENT_UI_TESTS = [
  "src/ui/coaching/__tests__/buildRealReplayCoachingFixture.test.js",
  "src/ui/screens/__tests__/ReplayScreen.coachingRealFixture.test.jsx",
];

const TIER1_IRON_SAFETY_TESTS = [
  "src/ai/iron/__tests__/verifyStep*GovernanceFreeze.test.js",
  "src/ai/iron/__tests__/{auditCrossVariantRegression,auditFallbackCoexistence,auditIronSourcePriority,auditPostExportIronRegression,auditSourcePriorityFreezeDecision,auditStep41RegressionAndSafety,auditStep42RegressionSafety,auditStep43Safety,auditStep44Safety,auditStep45RegressionSafety,buildDryRunGovernanceMetadata,buildStep58DeployReadinessChecklist,decidePreExportApproval,decideS02DeepExportGovernance,decideS02Exportability,decideS02StackDepthExportability,defineExpansionGuardrails,defineMonitorRetentionPolicy,defineShadowTelemetryPolicy,ironCandidatePolicy,ironDatasetQuality,ironDryRunEligibility,playerCountDefinitionAudit,replayCompatiblePlayerCount,reviewPromotionReadiness,validateReplayAnnotationDeterminism,validateReplayBackedSignals,validateReplayReferenceDeterminism,validateStep52ReplayTelemetryDeterminism,verifyCoachingRollbackFree,verifySmokeArenaSafety}.test.js",
];

const PROJECT_BASE = {
  environment: "jsdom",
  reporters: ["dot"],
};

export default defineConfig({
  test: {
    ...PROJECT_BASE,
    exclude: BASE_EXCLUDE,
    projects: [
      {
        extends: true,
        test: {
          ...PROJECT_BASE,
          name: "tier1",
          include: [
            "src/games/**/*.{test,spec}.{js,jsx,ts,tsx}",
            "src/games/_core/**/*.{test,spec}.{js,jsx,ts,tsx}",
            "src/games/testing/**/*.{test,spec}.{js,jsx,ts,tsx}",
            "src/ui/**/*.{test,spec}.{js,jsx,ts,tsx}",
            "src/components/**/*.{test,spec}.{js,jsx,ts,tsx}",
            "src/utils/**/*.{test,spec}.{js,jsx,ts,tsx}",
            "src/rl/**/*.{test,spec}.{js,jsx,ts,tsx}",
            "src/ai/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}",
            "src/ai/pro/**/*.{test,spec}.{js,jsx,ts,tsx}",
            "src/ai/evaluation/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}",
            ...TIER1_IRON_SAFETY_TESTS,
          ],
          exclude: [
            ...BASE_EXCLUDE,
            ...TIER2_UI_TESTS,
            ...TIER3_EVALUATION_TESTS,
            ...TIER3_REPORT_DEPENDENT_UI_TESTS,
          ],
        },
      },
      {
        extends: true,
        test: {
          ...PROJECT_BASE,
          name: "tier2",
          include: TIER2_UI_TESTS,
          exclude: [...BASE_EXCLUDE, ...TIER3_REPORT_DEPENDENT_UI_TESTS],
        },
      },
      {
        extends: true,
        test: {
          ...PROJECT_BASE,
          name: "tier3",
          include: [
            "src/ai/iron/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}",
            ...TIER3_EVALUATION_TESTS,
            ...TIER3_REPORT_DEPENDENT_UI_TESTS,
          ],
          exclude: [...BASE_EXCLUDE, ...TIER1_IRON_SAFETY_TESTS],
          pool: "forks",
          maxWorkers: 1,
          fileParallelism: false,
        },
      },
    ],
  },
});
