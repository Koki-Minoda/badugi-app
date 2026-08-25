import { test } from "@playwright/test";
import { createGameplaySoakHarness } from "./helpers/gameplaySoakHarness";
import {
  assertNoSqlTrapFailures,
  buildCore5SoakScenarios,
  runCore5SoakScenario,
} from "./helpers/core5SoakE2EHelper";

const harness = createGameplaySoakHarness({
  suite: "gameplay-soak-core5-cash",
  tier: process.env.SOAK_TIER ?? "standard",
  runLabel: process.env.SOAK_RUN_LABEL ?? `core5-cash-${Date.now()}`,
});

const scenarios = buildCore5SoakScenarios({
  mode: "cash",
  scenarioPrefix: "core5-cash",
  defaultSeedsPerVariant: 2,
});

test.afterAll(() => {
  assertNoSqlTrapFailures(harness.finishRun());
});

test.describe.configure({ mode: "serial", timeout: Math.max(120000, Number(process.env.SOAK_TIMEOUT_MS ?? 240000)) });

test.describe("Gameplay soak Core5 cash SQLite telemetry", () => {
  for (const scenario of scenarios) {
    test(`${scenario.variant.label} cash seed ${scenario.seed}`, async ({ page }) => {
      await runCore5SoakScenario({ page, harness, scenario });
    });
  }
});
