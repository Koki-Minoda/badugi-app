import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { openAuthenticatedGame } from "./authHelper";
import {
  getProgressState,
  playOneHandProgression,
  summarizeProgressState,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

const REPORT_PATH = path.resolve("reports/alpha/badugi-long-run-restore-repro.json");

function captureFatalBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (!/favicon|ResizeObserver loop|Failed to load resource: the server responded with a status of 404/i.test(text)) {
      errors.push(text);
    }
  });
  return errors;
}

async function openBadugiPreview(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page);
  await waitForE2EDriver(page);
}

async function visibleTotalPot(page: Page) {
  return page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    const match = text.match(/Total Pot\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  });
}

async function visibleActionButtonCount(page: Page) {
  return page.evaluate(() => {
    const selectors = [
      "[data-testid='action-check']",
      "[data-testid='action-call']",
      "[data-testid='action-raise']",
      "[data-testid='action-fold']",
      "[data-testid='action-draw-selected']",
    ];
    return selectors.filter((selector) => {
      const element = document.querySelector(selector) as HTMLButtonElement | null;
      if (!element || element.disabled) return false;
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    }).length;
  });
}

async function captureLongRunCheckpoint(page: Page, hand: number, checkpoint: string) {
  const state = await getProgressState(page);
  const pot = await visibleTotalPot(page);
  const handResultVisible = await page
    .getByText("Hand Result")
    .first()
    .isVisible()
    .catch(() => false);
  const nextHandVisible = await page
    .getByRole("button", { name: /next hand/i })
    .first()
    .isVisible()
    .catch(() => false);
  const handResultPotVisible = await page
    .getByTestId("hand-result-pot")
    .first()
    .isVisible()
    .catch(() => false);
  const actionButtonCount = await visibleActionButtonCount(page);
  const snapshotPlayers = state?.snapshot?.players ?? [];
  const invested = snapshotPlayers.reduce(
    (sum: number, player: any) =>
      sum +
      Math.max(0, Number(player?.totalInvested) || 0) +
      Math.max(0, Number(player?.betThisRound) || Number(player?.bet) || 0),
    0,
  );
  return {
    hand,
    checkpoint,
    visiblePot: pot,
    controllerPot: Number(state?.snapshot?.pot ?? state?.state?.potTotal ?? 0),
    invested,
    phase: state?.phase ?? null,
    drawRound: state?.drawRoundIndex ?? null,
    actor: state?.actor ?? null,
    terminal: Boolean(state?.isTerminal || handResultVisible),
    handResultVisible,
    handResultPotVisible,
    nextHandVisible,
    actionButtonCount,
    summary: summarizeProgressState(state),
  };
}

async function expectActiveHandPotVisible(page: Page, hand: number, checkpoint: string, rows: any[]) {
  const row = await captureLongRunCheckpoint(page, hand, checkpoint);
  rows.push(row);
  if (row.terminal) return;
  const pot = await visibleTotalPot(page);
  expect(pot, "active hand should render a pot value").not.toBeNull();
  expect(pot ?? 0, "active hand should not render Total Pot 0").toBeGreaterThan(0);
}

function classifyFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/active hand should not render Total Pot 0|active hand should render a pot value/i.test(message)) {
    return "ACTIVE_POT_ZERO";
  }
  if (/Hand Result|hand-result-pot|next hand|terminal/i.test(message)) {
    return "TERMINAL_TRANSITION_MISMATCH";
  }
  if (/Freeze detected/i.test(message)) {
    return "CONTROLLER_STATE_STALE";
  }
  if (/visible|locator|toBeVisible|toBeHidden/i.test(message)) {
    return "UI_RENDER_STALE";
  }
  return "UNKNOWN";
}

test.describe("Badugi alpha long-run smoke", () => {
  test.describe.configure({ timeout: 300000 });

  test("completes five preview hands without freeze, pot loss, or fatal browser errors", async ({ page }) => {
    const browserErrors = captureFatalBrowserErrors(page);
    const checkpoints: any[] = [];
    let classification = "PASS";
    let failureMessage: string | null = null;

    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openBadugiPreview(page);
      await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
      await expectActiveHandPotVisible(page, 0, "initial-hand-start", checkpoints);

      const handResults = [];
      for (let hand = 0; hand < 5; hand += 1) {
        const result = await playOneHandProgression(page, {
          maxSteps: 110,
          policy: "safe",
          requireHeroButtonClick: true,
          requireDrawVisit: true,
          onStep: async ({ step }) => {
            await expectActiveHandPotVisible(page, hand, `active-step-${step}`, checkpoints);
          },
        });
        expect(result.status).toBe("PASS");
        expect(result.heroButtonClicks).toBeGreaterThan(0);
        expect(result.visitedPhases).toContain("DRAW");

        await expect(page.getByText("Hand Result").first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 10000 });
        const terminalRow = await captureLongRunCheckpoint(page, hand, "terminal-result");
        checkpoints.push(terminalRow);
        expect(terminalRow.handResultVisible).toBe(true);
        expect(terminalRow.handResultPotVisible).toBe(true);
        expect(terminalRow.nextHandVisible).toBe(true);
        handResults.push({
          hand,
          steps: result.steps,
          visitedDrawRounds: result.visitedDrawRounds,
        });

        await page.getByRole("button", { name: /next hand/i }).click();
        await expect(page.getByText("Hand Result").first()).toBeHidden({ timeout: 10000 });
        await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
        await expectActiveHandPotVisible(page, hand + 1, "after-next-hand", checkpoints);
      }

      expect(handResults).toHaveLength(5);
      expect(browserErrors).toEqual([]);
    } catch (error) {
      classification = classifyFailure(error);
      failureMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
      fs.writeFileSync(
        REPORT_PATH,
        `${JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            classification,
            failureMessage,
            checkpoints,
            browserErrors,
          },
          null,
          2,
        )}\n`,
      );
    }
  });
});
