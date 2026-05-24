import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  APP_URL,
  openAuthenticatedGame,
} from "./authHelper";
import {
  playOneHandProgression,
} from "./helpers/gameProgressHelper.js";

async function openMobilePage(
  browser: Browser,
  orientation: "landscape" | "portrait" = "landscape",
  platform: "iphone" | "android" = "iphone",
) {
  const viewport =
    orientation === "landscape"
      ? { width: 844, height: 390 }
      : { width: 390, height: 844 };
  const userAgent =
    platform === "android"
      ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36"
      : "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const context = await browser.newContext({
    viewport,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent,
  });
  return { context, page: await context.newPage() };
}

async function closeContext(context: BrowserContext) {
  await context.close().catch(() => {});
}

async function expectCardInsideViewport(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  const viewport = page.viewportSize();
  expect(box, `${testId} should have a layout box`).not.toBeNull();
  expect(viewport, "viewport should be known").not.toBeNull();
  if (!box || !viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

async function expectMobileLayoutIsUsable(page: Page, lastHeroCard: string) {
  await expect(page.getByTestId(lastHeroCard)).toBeVisible({ timeout: 20000 });
  await expectCardInsideViewport(page, lastHeroCard);
  await expectCardInsideViewport(page, "decision-panel");
  const scrollMetrics = await page.evaluate(() => ({
    bodyScrolls: document.body.scrollHeight > window.innerHeight + 2,
    rootScrolls: document.documentElement.scrollHeight > window.innerHeight + 2,
  }));
  expect(scrollMetrics.bodyScrolls).toBe(false);
  expect(scrollMetrics.rootScrolls).toBe(false);
}

test.describe("mobile App smoke", () => {
  test.describe.configure({ timeout: 120000 });

  test("allows Core 5 gameplay on mobile portrait", async ({ browser }) => {
    const { context, page } = await openMobilePage(browser, "portrait");
    try {
      await openAuthenticatedGame(page, `${APP_URL}?variant=D01`);
      await expect(page.getByText("Landscape mode required")).toHaveCount(0);
      await expect(page.getByText("MGXはスマホ横画面に最適化されています")).toHaveCount(0);
      await expectMobileLayoutIsUsable(page, "player-0-card-4");
    } finally {
      await closeContext(context);
    }
  });

  for (const { variant, lastHeroCard } of [
    { variant: "badugi", lastHeroCard: "player-0-card-3" },
    { variant: "D01", lastHeroCard: "player-0-card-4" },
    { variant: "D02", lastHeroCard: "player-0-card-4" },
    { variant: "S01", lastHeroCard: "player-0-card-4" },
    { variant: "S02", lastHeroCard: "player-0-card-4" },
  ]) {
    test(`plays ${variant} controls on mobile landscape`, async ({ browser }) => {
      const { context, page } = await openMobilePage(browser, "landscape");
      try {
        if (variant === "badugi") {
          await page.addInitScript(() => {
            window.localStorage.setItem("mgx.previewVariants", "true");
          });
        }
        await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
        await expectMobileLayoutIsUsable(page, lastHeroCard);

        await playOneHandProgression(page, {
          maxSteps: 90,
          policy: "safe",
          requireHeroButtonClick: true,
          requireDrawVisit: true,
        });
      } finally {
        await closeContext(context);
      }
    });
  }

  test("keeps Android landscape actions and cards inside viewport", async ({ browser }) => {
    const { context, page } = await openMobilePage(browser, "landscape", "android");
    try {
      await page.addInitScript(() => {
        window.localStorage.setItem("mgx.previewVariants", "true");
      });
      await openAuthenticatedGame(page, `${APP_URL}?variant=badugi`);
      await expectMobileLayoutIsUsable(page, "player-0-card-3");
      await playOneHandProgression(page, {
        maxSteps: 90,
        policy: "safe",
        requireHeroButtonClick: true,
        requireDrawVisit: true,
      });
    } finally {
      await closeContext(context);
    }
  });
});
