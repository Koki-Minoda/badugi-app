import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_PATH = path.resolve("reports/ui/mobile-tournament-visual-viewport.json");
const SCREENSHOT_DIR = path.resolve("reports/screenshots/mobile-tournament-visual-viewport");

function ensureReportDirs() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function openFixture(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=badugi&mode=tournament&mgxQa=mobile`);
  await waitForE2EDriver(page);
  await invokeE2E(page, "setupMobileTournamentHeroActionFixtureForTest", { variantId: "badugi" });
}

async function visualState(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector(".mgx-mobile-landscape");
    const panel = document.querySelector('[data-testid="decision-panel"]');
    const buttons = ["action-call", "action-raise", "action-fold"].map((testId) => {
      const element = document.querySelector(`[data-testid="${testId}"]`);
      const box = element?.getBoundingClientRect();
      return {
        testId,
        box: box ? { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom } : null,
      };
    });
    const rootBox = root?.getBoundingClientRect();
    const panelBox = panel?.getBoundingClientRect();
    return {
      visualViewportHeight: window.visualViewport?.height ?? window.innerHeight,
      visualViewportWidth: window.visualViewport?.width ?? window.innerWidth,
      cssVisualVh: getComputedStyle(document.documentElement).getPropertyValue("--mgx-visual-vh").trim(),
      cssVisualVw: getComputedStyle(document.documentElement).getPropertyValue("--mgx-visual-vw").trim(),
      rootBox: rootBox ? { y: rootBox.y, height: rootBox.height, bottom: rootBox.bottom } : null,
      panelBox: panelBox ? { y: panelBox.y, height: panelBox.height, bottom: panelBox.bottom } : null,
      buttons,
    };
  });
}

function expectButtonsInside(state: Awaited<ReturnType<typeof visualState>>) {
  expect(state.cssVisualVh).toMatch(/px$/);
  expect(state.rootBox?.bottom ?? 0).toBeLessThanOrEqual(state.visualViewportHeight + 1);
  expect(state.panelBox?.bottom ?? 0).toBeLessThanOrEqual(state.visualViewportHeight + 1);
  for (const button of state.buttons) {
    expect(button.box, `${button.testId} box`).toBeTruthy();
    expect(button.box!.bottom, `${button.testId} bottom`).toBeLessThanOrEqual(state.visualViewportHeight + 1);
    expect(button.box!.y, `${button.testId} top`).toBeGreaterThanOrEqual(0);
  }
}

test.describe("mobile tournament visual viewport sizing", () => {
  test.describe.configure({ timeout: 180000 });
  const rows: unknown[] = [];

  test.afterAll(() => {
    ensureReportDirs();
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2)}\n`);
  });

  test("updates visual viewport CSS vars and keeps controls visible after landscape height shrinks", async ({ page }) => {
    ensureReportDirs();
    await page.setViewportSize({ width: 844, height: 360 });
    await openFixture(page);
    await expect(page.getByTestId("action-call")).toBeVisible({ timeout: 10000 });
    const initial = await visualState(page);
    expectButtonsInside(initial);

    await page.setViewportSize({ width: 844, height: 300 });
    await page.waitForFunction(() => {
      const value = getComputedStyle(document.documentElement).getPropertyValue("--mgx-visual-vh");
      return value.trim().startsWith("300");
    });
    const shrunk = await visualState(page);
    expectButtonsInside(shrunk);
    const screenshotPath = path.join(SCREENSHOT_DIR, "badugi-landscape-shrunk-844x300.png");
    rows.push({ status: "PASS", initial, shrunk, screenshotPath });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });

  test("portrait remains playable after visual viewport sizing is installed", async ({ page }) => {
    ensureReportDirs();
    await page.setViewportSize({ width: 390, height: 844 });
    await openFixture(page);
    await expect(page.getByTestId("action-call")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("action-call").click({ trial: true });
    const state = await visualState(page);
    rows.push({ status: "PASS", viewport: "portrait-390x844", state });
  });
});
