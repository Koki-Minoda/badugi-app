import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_PATH = path.resolve("reports/ui/mobile-tournament-landscape-action-buttons.json");
const SCREENSHOT_DIR = path.resolve("reports/screenshots/mobile-tournament-landscape-action-buttons");

const PWA_LANDSCAPE_VIEWPORTS = [
  { name: "iphone-pwa-landscape-844x390", width: 844, height: 390 },
  { name: "iphone-pwa-tight-landscape-844x360", width: 844, height: 360 },
] as const;

const SANITY_VIEWPORTS = [
  { name: "iphone-portrait-390x844", width: 390, height: 844, mode: "portrait" },
] as const;

function ensureReportDirs() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function openPwaPage(browser: Browser, viewport: { width: number; height: number }) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  return { context, page };
}

async function openFixture(page: Page, variantId: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variantId}&mode=tournament&mgxQa=mobile`);
  await waitForE2EDriver(page);
  await invokeE2E(page, "setupMobileTournamentHeroActionFixtureForTest", { variantId });
  await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 10000 });
}

async function boxFor(locator: Locator) {
  if (!(await locator.isVisible().catch(() => false))) return null;
  return locator.boundingBox();
}

async function visualViewport(page: Page) {
  return page.evaluate(() => ({
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
    scrollX: window.visualViewport?.pageLeft ?? window.scrollX,
    scrollY: window.visualViewport?.pageTop ?? window.scrollY,
  }));
}

async function assertButtonFullyUsable(page: Page, testId: string) {
  const locator = page.getByTestId(testId);
  await expect(locator).toBeVisible();
  const box = await boxFor(locator);
  expect(box, `${testId} should have a layout box`).toBeTruthy();
  const viewport = await visualViewport(page);
  const visibleHeight = Math.max(
    0,
    Math.min(box!.y + box!.height, viewport.height) - Math.max(box!.y, 0),
  );
  const heightRatio = visibleHeight / Math.max(1, box!.height);
  expect(
    heightRatio,
    `${testId} visible height ratio: ${JSON.stringify({ box, viewport })}`,
  ).toBeGreaterThanOrEqual(0.9);
  expect(box!.x, `${testId} left should be inside viewport`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${testId} right should be inside viewport`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height, `${testId} bottom should be inside viewport`).toBeLessThanOrEqual(viewport.height + 1);
  await locator.click({ trial: true, timeout: 1500 });
}

async function collectMetrics(page: Page) {
  const viewport = await visualViewport(page);
  const decisionBox = await boxFor(page.getByTestId("decision-panel"));
  const callBox = await boxFor(page.getByTestId("action-call"));
  const raiseBox = await boxFor(page.getByTestId("action-raise"));
  const foldBox = await boxFor(page.getByTestId("action-fold"));
  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
    vertical: document.documentElement.scrollHeight - window.innerHeight,
  }));
  return { viewport, decisionBox, callBox, raiseBox, foldBox, overflow };
}

async function assertBetButtonsUsable(page: Page, variantId: string) {
  if (variantId.toLowerCase() === "badugi") {
    await assertButtonFullyUsable(page, "action-call");
  } else if (await page.getByTestId("action-call").isVisible().catch(() => false)) {
    await assertButtonFullyUsable(page, "action-call");
  } else {
    await assertButtonFullyUsable(page, "action-check");
  }
  await assertButtonFullyUsable(page, "action-raise");
  await assertButtonFullyUsable(page, "action-fold");
}

test.describe("mobile tournament landscape action buttons", () => {
  test.describe.configure({ timeout: 180000 });

  const rows: unknown[] = [];

  test.afterAll(() => {
    ensureReportDirs();
    fs.writeFileSync(
      REPORT_PATH,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2)}\n`,
    );
  });

  for (const variantId of ["badugi"] as const) {
    for (const viewport of PWA_LANDSCAPE_VIEWPORTS) {
      test(`${variantId} tournament ${viewport.name} keeps Call/Raise/Fold fully visible`, async ({ browser }) => {
        ensureReportDirs();
        const { context, page } = await openPwaPage(browser, viewport);
        const screenshotPath = path.join(SCREENSHOT_DIR, `${variantId}-${viewport.name}.png`);
        try {
          await openFixture(page, variantId);
          await assertBetButtonsUsable(page, variantId);
          const metrics = await collectMetrics(page);
          rows.push({ variantId, viewport: viewport.name, status: "PASS", metrics, screenshotPath });
          await page.screenshot({ path: screenshotPath, fullPage: true });
        } finally {
          await context.close().catch(() => {});
        }
      });
    }
  }

  for (const viewport of SANITY_VIEWPORTS) {
    test(`Badugi tournament ${viewport.name} sanity keeps action buttons usable`, async ({ page }) => {
      ensureReportDirs();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const screenshotPath = path.join(SCREENSHOT_DIR, `badugi-${viewport.name}.png`);
      await openFixture(page, "badugi");
      await assertBetButtonsUsable(page, "badugi");
      const metrics = await collectMetrics(page);
      rows.push({ variantId: "badugi", viewport: viewport.name, status: "PASS", metrics, screenshotPath });
      await page.screenshot({ path: screenshotPath, fullPage: true });
    });
  }
});
