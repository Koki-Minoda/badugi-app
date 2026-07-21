import { defineConfig } from "vitest/config";

// These suites validate locally generated AI corpora and reports that are
// intentionally excluded from Git. Run them with `npm run test:artifacts`
// after restoring or regenerating the required datasets.
export const artifactDependentTests = [
  "src/ui/screens/__tests__/ReplayScreen.coachingRealFixture.test.jsx",
  "src/ai/evaluation/__tests__/actionValueDataset.test.js",
  "src/ai/iron/__tests__/acquireS02DeepPlayerCountReplay.test.js",
  "src/ai/iron/__tests__/buildS02DeepPreExportRows.test.js",
  "src/ai/iron/__tests__/finalizeActionValueDatasetDiff.test.js",
  "src/ai/iron/__tests__/forcedActionReplayHarness.test.js",
  "src/ai/iron/__tests__/previewActionValueDatasetDiff.test.js",
  "src/ai/iron/__tests__/refreshDatasetConcentrationRisk.test.js",
  "src/ai/iron/__tests__/replayS02DeepPlayerCountBranches.test.js",
  "src/ai/iron/__tests__/runForcedActionReplay.test.js",
  "src/ai/iron/__tests__/runS02StackDepthForcedReplay.test.js",
  "src/ai/iron/__tests__/s02LowerMediumForcedReplay.test.js",
  "src/ai/iron/__tests__/validatePreExportPackage.test.js",
  "src/ai/iron/__tests__/variantBalancedDataset.test.js",
  "src/ai/iron/__tests__/writeApprovedActionValueDataset.test.js",
  "src/ui/coaching/__tests__/buildRealReplayCoachingFixture.test.js",
];

export default defineConfig({
  test: {
    exclude: [
      "node_modules",
      "dist",
      "e2e/**",
      "tests/e2e/**",
      "tests/badugi-regression/**",
      ...artifactDependentTests,
    ],
    environment: "jsdom",
    reporters: ["dot"],
  },
});
