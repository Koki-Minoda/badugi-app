import { expect, type Page } from "@playwright/test";
import {
  getSoakTierConfig,
  policyForSeed,
  resolveSoakSeeds,
  resolveSoakVariants,
  resolveSoakViewports,
  SOAK_VIEWPORTS,
} from "../../../src/ui/qa/gameplaySoak/config.js";
import {
  CORE5_VARIANTS,
  openCore5Cash,
  startCore5Tournament,
} from "./core5LifecycleE2EHelper";
import { installSoakSeed } from "./gameplaySoakHarness";

const lifecycleVariantById = new Map(CORE5_VARIANTS.map((variant) => [variant.variant, variant]));

export function buildCore5SoakScenarios({
  mode,
  scenarioPrefix,
  defaultViewports = [SOAK_VIEWPORTS[0]],
  defaultSeedsPerVariant = 1,
}: {
  mode: "cash" | "tournament";
  scenarioPrefix: string;
  defaultViewports?: typeof SOAK_VIEWPORTS;
  defaultSeedsPerVariant?: number;
}) {
  const config = getSoakTierConfig();
  const seedsPerVariant = Math.max(1, Number(process.env.SOAK_SEEDS_PER_VARIANT ?? defaultSeedsPerVariant));
  const minEvents = Math.max(1, Number(process.env.SOAK_MIN_EVENTS ?? 10));
  const maxEvents = Math.max(minEvents, Number(process.env.SOAK_MAX_EVENTS ?? 30));
  const variants = resolveSoakVariants();
  const seeds = resolveSoakSeeds(config).slice(0, seedsPerVariant);
  const viewports = resolveSoakViewports(defaultViewports);

  return variants.flatMap((variant) => {
    const lifecycleVariant = lifecycleVariantById.get(variant.id);
    if (!lifecycleVariant) {
      throw new Error(`No Core5 lifecycle fixture for soak variant ${variant.id}`);
    }
    return viewports.flatMap((viewport) =>
      seeds.map((seed, seedIndex) => ({
        id: [
          scenarioPrefix,
          variant.id.toLowerCase(),
          mode,
          viewport.id,
          `seed-${seed}`,
        ].join("-"),
        traceMode: config.traceMode,
        variant,
        lifecycleVariant,
        mode,
        seed,
        viewport,
        policy: policyForSeed(seed + seedIndex),
        maxSteps: Number(process.env.SOAK_MAX_STEPS ?? variant.maxSteps),
        minEvents,
        maxEvents,
        hands: config.handsPerScenario,
        timeoutMs: config.timeoutMs,
      })),
    );
  });
}

export async function runCore5SoakScenario({
  page,
  harness,
  scenario,
}: {
  page: Page;
  harness: any;
  scenario: ReturnType<typeof buildCore5SoakScenarios>[number];
}) {
  testScenarioHasViewport(scenario);
  const state = harness.startScenario(scenario);
  await harness.attachRecorders(page, state);
  await page.setViewportSize({
    width: scenario.viewport.width,
    height: scenario.viewport.height,
  });
  await installSoakSeed(page, scenario.seed);

  try {
    if (scenario.mode === "tournament") {
      await startCore5Tournament(page, scenario.lifecycleVariant);
    } else {
      await openCore5Cash(page, scenario.lifecycleVariant);
    }
    await page.evaluate(() => window.__MGX_CLEAR_GAMEPLAY_TRACE__?.()).catch(() => null);
    const progression = await harness.playProgression(page, state, {
      minEvents: scenario.minEvents,
      maxEvents: scenario.maxEvents,
      maxSteps: scenario.maxSteps,
      policy: scenario.policy,
    });
    const result = await harness.finishScenario(page, state, {
      status: "PASS",
      hands_attempted: scenario.hands,
      hands_completed: progression.handsCompleted,
      actions_observed: progression.actionsObserved,
    });
    expect(result.status).toBe("PASS");
    return result;
  } catch (error) {
    await harness.finishScenario(page, state, {
      status: "FAIL",
      hands_attempted: scenario.hands,
      hands_completed: 0,
      actions_observed: state.traceRows.length,
      error_message: error instanceof Error ? error.message : String(error),
    }).catch(() => null);
    throw error;
  }
}

export function assertNoSqlTrapFailures(result: any) {
  const trapFailures = (result?.sqliteResult?.traps ?? []).filter((trap: any) => Number(trap.matched_count ?? 0) > 0);
  expect(trapFailures).toEqual([]);
}

function testScenarioHasViewport(scenario: ReturnType<typeof buildCore5SoakScenarios>[number]) {
  if (!scenario.viewport?.width || !scenario.viewport?.height) {
    throw new Error(`Soak scenario ${scenario.id} is missing concrete viewport dimensions`);
  }
}
