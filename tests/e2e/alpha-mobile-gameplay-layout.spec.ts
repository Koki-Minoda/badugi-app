import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import {
  expectMobileActionsInViewport,
  playOneHandProgression,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

const ALPHA_VARIANTS = [
  { variant: "D02", title: /A-5 Triple Draw/i },
  { variant: "S01", title: /2-7 Single Draw/i },
  { variant: "S02", title: /A-5 Single Draw/i },
] as const;

const VIEWPORTS = [
  { name: "portrait-390", width: 390, height: 844 },
  { name: "portrait-430", width: 430, height: 932 },
  { name: "landscape-844", width: 844, height: 390 },
] as const;

function captureFatalBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!/favicon|ResizeObserver loop|Failed to load resource: the server responded with a status of 404/i.test(text)) {
        errors.push(text);
      }
    }
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(
      async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      { timeout: 10000 },
    )
    .toBeLessThanOrEqual(2);
}

async function expectPotAndPhaseVisible(page: Page) {
  await expect(page.getByText(/Total Pot/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Phase/i).first()).toBeVisible({ timeout: 10000 });
}

test.describe("alpha mobile gameplay layout", () => {
  test.describe.configure({ timeout: 180000 });

  for (const viewport of VIEWPORTS) {
    for (const { variant } of ALPHA_VARIANTS) {
      test(`${variant} ${viewport.name} keeps controls, pot, and phase within viewport`, async ({ page }) => {
        const browserErrors = captureFatalBrowserErrors(page);

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
        await waitForE2EDriver(page);

        await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
        await expectPotAndPhaseVisible(page);
        await expectMobileActionsInViewport(page);
        await expectNoHorizontalOverflow(page);

        expect(browserErrors).toEqual([]);
      });
    }
  }

  for (const { variant } of ALPHA_VARIANTS) {
    test(`${variant} portrait can reach result overlay after mobile layout fix`, async ({ page }) => {
      const browserErrors = captureFatalBrowserErrors(page);

      await page.setViewportSize({ width: 390, height: 844 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
      await waitForE2EDriver(page);

      await expectMobileActionsInViewport(page);
      await playOneHandProgression(page, {
        maxSteps: 90,
        policy: "safe",
        requireHeroButtonClick: true,
        requireDrawVisit: true,
      });

      await expect(page.getByText("Hand Result").first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 10000 });
      await expectNoHorizontalOverflow(page);

      expect(browserErrors).toEqual([]);
    });
  }
});
