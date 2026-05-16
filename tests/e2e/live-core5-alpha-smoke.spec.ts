import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { CORE5_VARIANTS, captureFatalBrowserErrors } from "./helpers/core5LayoutAuditHelper";
import {
  openLiveGame,
  openLiveTournament,
  writeLiveReport,
  type Core5Variant,
} from "./helpers/liveCore5Helper";
import {
  getProgressState,
  performSafeAction,
  progressKey,
  waitForE2EDriver,
  waitForProgressChange,
} from "./helpers/gameProgressHelper.js";

const REPORT_PATH = path.resolve("reports/alpha/live-core5-alpha-smoke.json");

type SmokeMode = "cash" | "tournament";

const rows: any[] = [];

async function playToResultOrBudget(page: Page, variant: Core5Variant, mode: SmokeMode) {
  let resultReached = false;
  let nextHandWorked = false;
  const checkpoints: any[] = [];

  for (let step = 0; step < variant.maxSteps; step += 1) {
    const progress = await getProgressState(page);
    checkpoints.push({
      step,
      phase: progress.phase,
      actor: progress.actor,
      drawRound: progress.drawRoundIndex,
      pot: progress.pot,
      handId: progress.handId,
    });

    if (await page.getByText("Hand Result").first().isVisible().catch(() => false)) {
      resultReached = true;
      await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 10000 });
      const nextHand = page.getByRole("button", { name: /next hand/i }).first();
      if (mode === "cash" && await nextHand.isVisible().catch(() => false)) {
        await nextHand.click();
        await expect(page.getByText("Hand Result").first()).toBeHidden({ timeout: 10000 });
        await waitForE2EDriver(page);
        nextHandWorked = true;
      }
      break;
    }

    if (progress?.isTerminal) {
      resultReached = true;
      break;
    }

    const beforeKey = progressKey(progress);
    const acted = await performSafeAction(page, { policy: "safe" });
    expect(acted.acted, JSON.stringify({ variant: variant.variant, mode, step, progress }, null, 2)).toBe(true);
    await waitForProgressChange(page, beforeKey, { timeout: 20000 }).catch(() => {});
  }

  return { resultReached, nextHandWorked, checkpoints };
}

async function runModeSmoke(page: Page, variant: Core5Variant, mode: SmokeMode) {
  const browserErrors = captureFatalBrowserErrors(page);
  const issues: string[] = [];

  if (mode === "tournament") {
    await openLiveTournament(page, variant);
  } else {
    await openLiveGame(page, variant);
  }

  await expect(page.getByTestId("game-table-surface")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("table-total-pot")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 30000 });
  if (mode === "tournament") {
    await expect(page.getByTestId("tournament-hud")).toBeVisible({ timeout: 30000 });
  }

  const result = await playToResultOrBudget(page, variant, mode);
  if (!result.resultReached) issues.push("RESULT_NOT_REACHED");
  if (mode === "cash" && !result.nextHandWorked) issues.push("NEXT_HAND_NOT_CONFIRMED");

  for (const message of browserErrors) {
    if (/favicon|ResizeObserver loop|Failed to load resource/i.test(message)) continue;
    issues.push(`BROWSER_FATAL:${message}`);
  }

  return {
    game: variant.game,
    variantId: variant.variant,
    mode,
    status: issues.length ? "FAIL" : "PASS",
    issues,
    resultReached: result.resultReached,
    nextHandWorked: result.nextHandWorked,
    checkpoints: result.checkpoints.slice(-10),
  };
}

test.describe("Live Core5 alpha smoke", () => {
  test.describe.configure({ timeout: 900000 });

  test.afterAll(() => {
    writeLiveReport(REPORT_PATH, rows, { liveUrl: "https://mgx-poker.com/" });
    expect(rows.filter((row) => row.status === "FAIL"), JSON.stringify(rows, null, 2)).toEqual([]);
  });

  for (const variant of CORE5_VARIANTS) {
    test(`${variant.game} live cash and tournament smoke`, async ({ page }) => {
      const cash = await runModeSmoke(page, variant, "cash");
      rows.push(cash);

      const tournament = await runModeSmoke(page, variant, "tournament");
      rows.push(tournament);
    });
  }
});
