import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import {
  expectMobileActionsInViewport,
  playOneHandProgression,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

const ALPHA_VARIANTS = [
  { variant: "D02", title: /A-5 Triple Draw/i, requireDrawVisit: true },
  { variant: "S01", title: /2-7 Single Draw/i, requireDrawVisit: true },
  { variant: "S02", title: /A-5 Single Draw/i, requireDrawVisit: true },
] as const;

const MOBILE_VIEWPORTS = [
  { name: "390x844 portrait", width: 390, height: 844 },
  { name: "430x932 portrait", width: 430, height: 932 },
  { name: "844x390 landscape", width: 844, height: 390 },
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

async function expectVisiblePositivePot(page: Page) {
  await expect
    .poll(
      async () => {
        const text = await page.locator("body").innerText();
        const match = text.match(/Total Pot\s+(\d+)/i);
        return match ? Number(match[1]) : 0;
      },
      { timeout: 20000 },
    )
    .toBeGreaterThan(0);
  await expect(page.getByText(/Total Pot/i).first()).toBeVisible({ timeout: 10000 });
}

test.describe("friend alpha playable variants smoke", () => {
  test.describe.configure({ timeout: 180000 });

  for (const { variant, title, requireDrawVisit } of ALPHA_VARIANTS) {
    test(`${variant} launches, completes one hand, and can advance`, async ({ page }) => {
      const browserErrors = captureFatalBrowserErrors(page);

      await page.setViewportSize({ width: 1440, height: 900 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
      await waitForE2EDriver(page);

      await expect(page.getByText(title).first()).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
      await expectVisiblePositivePot(page);

      const result = await playOneHandProgression(page, {
        maxSteps: 90,
        policy: "safe",
        requireHeroButtonClick: true,
        requireDrawVisit,
      });
      expect(result.status).toBe("PASS");
      expect(result.heroButtonClicks).toBeGreaterThan(0);

      await expect(page.getByText("Hand Result").first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: /next hand/i }).click();
      await expect(page.getByText("Hand Result").first()).toBeHidden({ timeout: 10000 });
      await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });

      expect(browserErrors).toEqual([]);
    });
  }

  for (const viewport of MOBILE_VIEWPORTS) {
    for (const { variant } of ALPHA_VARIANTS) {
      test(`${variant} keeps alpha controls visible on mobile ${viewport.name}`, async ({ page }) => {
        const browserErrors = captureFatalBrowserErrors(page);

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
        await waitForE2EDriver(page);

        await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
        await expectVisiblePositivePot(page);
        await expectMobileActionsInViewport(page);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(2);
        expect(browserErrors).toEqual([]);
      });
    }
  }
});
