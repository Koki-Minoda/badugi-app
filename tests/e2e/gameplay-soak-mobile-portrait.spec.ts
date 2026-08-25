import { test } from "@playwright/test";
import { SOAK_VIEWPORTS } from "../../src/ui/qa/gameplaySoak/config.js";
import { createGameplaySoakHarness } from "./helpers/gameplaySoakHarness";
import {
  assertNoSqlTrapFailures,
  buildCore5SoakScenarios,
  runCore5SoakScenario,
} from "./helpers/core5SoakE2EHelper";

const portrait390 = SOAK_VIEWPORTS.find((viewport) => viewport.id === "portrait-390x844") ?? SOAK_VIEWPORTS[2];

const harness = createGameplaySoakHarness({
  suite: "gameplay-soak-mobile-portrait",
  tier: process.env.SOAK_TIER ?? "standard",
  runLabel: process.env.SOAK_RUN_LABEL ?? `mobile-portrait-${Date.now()}`,
});

const scenarios = buildCore5SoakScenarios({
  mode: "cash",
  scenarioPrefix: "mobile-portrait",
  defaultViewports: [portrait390],
  defaultSeedsPerVariant: 1,
});

test.afterAll(() => {
  assertNoSqlTrapFailures(harness.finishRun());
});

test.describe.configure({ mode: "serial", timeout: Math.max(120000, Number(process.env.SOAK_TIMEOUT_MS ?? 240000)) });

test.describe("Gameplay soak mobile portrait SQLite telemetry", () => {
  for (const scenario of scenarios) {
    test(`${scenario.variant.label} mobile portrait seed ${scenario.seed}`, async ({ page }) => {
      await runCore5SoakScenario({ page, harness, scenario });
    });
  }
});
