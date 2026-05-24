import { test } from "@playwright/test";
import { createGameplaySoakHarness } from "./helpers/gameplaySoakHarness";
import {
  assertNoSqlTrapFailures,
  buildCore5SoakScenarios,
  runCore5SoakScenario,
} from "./helpers/core5SoakE2EHelper";

const harness = createGameplaySoakHarness({
  suite: "gameplay-soak-core5-tournament",
  tier: process.env.SOAK_TIER ?? "standard",
  runLabel: process.env.SOAK_RUN_LABEL ?? `core5-tournament-${Date.now()}`,
});

const scenarios = buildCore5SoakScenarios({
  mode: "tournament",
  scenarioPrefix: "core5-tournament",
  defaultSeedsPerVariant: 1,
});

test.afterAll(() => {
  assertNoSqlTrapFailures(harness.finishRun());
});

test.describe.configure({ mode: "serial", timeout: Math.max(120000, Number(process.env.SOAK_TIMEOUT_MS ?? 240000)) });

test.describe("Gameplay soak Core5 tournament SQLite telemetry", () => {
  for (const scenario of scenarios) {
    test(`${scenario.variant.label} tournament seed ${scenario.seed}`, async ({ page }) => {
      await runCore5SoakScenario({ page, harness, scenario });
    });
  }
});
