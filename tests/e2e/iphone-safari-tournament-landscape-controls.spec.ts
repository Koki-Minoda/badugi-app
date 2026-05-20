import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_PATH = path.resolve("reports/ui/iphone-safari-tournament-landscape-controls.json");
const SCREENSHOT_DIR = path.resolve("reports/screenshots/iphone-safari-tournament-landscape-controls");

const SAFARI_LANDSCAPE_VIEWPORTS = [
  { name: "safari-landscape-tabs-844x320", width: 844, height: 320 },
  { name: "safari-landscape-tight-844x300", width: 844, height: 300 },
] as const;

function ensureReportDirs() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function openIphoneSafariPage(browser: Browser, viewport: { width: number; height: number }) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  });
  return { context, page: await context.newPage() };
}

async function openHeroActionFixture(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=badugi&mode=tournament&mgxQa=mobile`);
  await waitForE2EDriver(page);
  await invokeE2E(page, "setupMobileTournamentHeroActionFixtureForTest", { variantId: "badugi" });
  await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 10000 });
}

async function viewportMetrics(page: Page) {
  return page.evaluate(() => ({
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
    cssVisualVh: getComputedStyle(document.documentElement).getPropertyValue("--mgx-visual-vh").trim(),
    cssVisualVw: getComputedStyle(document.documentElement).getPropertyValue("--mgx-visual-vw").trim(),
  }));
}

async function assertButtonWithinVisualViewport(page: Page, locator: Locator, label: string) {
  await expect(locator, `${label} visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} should have a box`).toBeTruthy();
  const viewport = await viewportMetrics(page);
  const visibleHeight = Math.max(
    0,
    Math.min(box!.y + box!.height, viewport.height) - Math.max(box!.y, 0),
  );
  expect(visibleHeight / Math.max(1, box!.height), `${label} visible height`).toBeGreaterThanOrEqual(0.9);
  expect(box!.x, `${label} left`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${label} right`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height, `${label} bottom`).toBeLessThanOrEqual(viewport.height + 1);
  await locator.click({ trial: true, timeout: 1500 });
}

test.describe("iPhone Safari tournament landscape controls", () => {
  test.describe.configure({ timeout: 180000 });
  const rows: unknown[] = [];

  test.afterAll(() => {
    ensureReportDirs();
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2)}\n`);
  });

  for (const viewport of SAFARI_LANDSCAPE_VIEWPORTS) {
    test(`Badugi tournament ${viewport.name} keeps Hero action buttons inside visual viewport`, async ({ browser }) => {
      ensureReportDirs();
      const { context, page } = await openIphoneSafariPage(browser, viewport);
      const screenshotPath = path.join(SCREENSHOT_DIR, `badugi-${viewport.name}.png`);
      try {
        await openHeroActionFixture(page);
        const decisionBox = await page.getByTestId("decision-panel").boundingBox();
        const metrics = await viewportMetrics(page);
        expect(metrics.cssVisualVh).toMatch(/px$/);
        expect(decisionBox?.y ?? 0).toBeGreaterThanOrEqual(0);
        expect((decisionBox?.y ?? 0) + (decisionBox?.height ?? 0)).toBeLessThanOrEqual(metrics.height + 1);
        await assertButtonWithinVisualViewport(page, page.getByTestId("action-call"), "Call");
        await assertButtonWithinVisualViewport(page, page.getByTestId("action-raise"), "Raise");
        await assertButtonWithinVisualViewport(page, page.getByTestId("action-fold"), "Fold");
        const overflow = await page.evaluate(() => ({
          horizontal: document.documentElement.scrollWidth - window.innerWidth,
          vertical: document.documentElement.scrollHeight - window.innerHeight,
        }));
        rows.push({ viewport: viewport.name, status: "PASS", metrics, decisionBox, overflow, screenshotPath });
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } finally {
        await context.close().catch(() => {});
      }
    });
  }
});
