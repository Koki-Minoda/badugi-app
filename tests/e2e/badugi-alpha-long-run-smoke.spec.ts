import { test, expect, type Page } from "@playwright/test";
import { openAuthenticatedGame } from "./authHelper";
import {
  expectMobileActionsInViewport,
  getProgressState,
  playOneHandProgression,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

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

async function expectActiveHandPotVisible(page: Page) {
  const state = await getProgressState(page);
  if (state?.isTerminal) return;
  const pot = await visibleTotalPot(page);
  expect(pot, "active hand should render a pot value").not.toBeNull();
  expect(pot ?? 0, "active hand should not render Total Pot 0").toBeGreaterThan(0);
}

test.describe("Badugi alpha long-run smoke", () => {
  test.describe.configure({ timeout: 300000 });

  test("completes five preview hands without freeze, pot loss, or fatal browser errors", async ({ page }) => {
    test.fail(true, "Known Badugi alpha-restore blocker: long-run preview can still surface active-hand Total Pot 0 / terminal transition mismatch.");

    const browserErrors = captureFatalBrowserErrors(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await openBadugiPreview(page);
    await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
    await expectActiveHandPotVisible(page);

    const handResults = [];
    for (let hand = 0; hand < 5; hand += 1) {
      const result = await playOneHandProgression(page, {
        maxSteps: 110,
        policy: "safe",
        requireHeroButtonClick: true,
        requireDrawVisit: true,
      });
      expect(result.status).toBe("PASS");
      expect(result.heroButtonClicks).toBeGreaterThan(0);
      expect(result.visitedPhases).toContain("DRAW");

      await expect(page.getByText("Hand Result").first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 10000 });
      handResults.push({
        hand,
        steps: result.steps,
        visitedDrawRounds: result.visitedDrawRounds,
      });

      if (hand < 4) {
        await page.getByRole("button", { name: /next hand/i }).click();
        await expect(page.getByText("Hand Result").first()).toBeHidden({ timeout: 10000 });
        await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
        await expectActiveHandPotVisible(page);
      }
    }

    await expectMobileActionsInViewport(page);
    expect(handResults).toHaveLength(5);
    expect(browserErrors).toEqual([]);
  });
});
