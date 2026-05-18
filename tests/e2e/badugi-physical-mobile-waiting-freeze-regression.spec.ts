import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

const REPORT_DIR = path.resolve("reports/browser-gameplay");
const SCREENSHOT_DIR = path.resolve("reports/screenshots");
const REPORT_PATH = path.join(REPORT_DIR, "badugi-physical-mobile-waiting-freeze-summary.json");
const SCREENSHOT_PATH = path.join(SCREENSHOT_DIR, "badugi-physical-mobile-waiting-freeze.png");

function ensureDirs() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function writeReport(payload: unknown) {
  ensureDirs();
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
}

async function waitForE2EDriver(page: Page) {
  await page.waitForFunction(
    () =>
      typeof window.__BADUGI_E2E__?.startTournamentMTT === "function" &&
      typeof window.__BADUGI_E2E__?.setupBadugiWaitingFreezeFixtureForTest === "function" &&
      typeof window.__MGX_EXPORT_FREEZE_REPORT__ === "function",
    { timeout: 60000 },
  );
}

async function openBadugiTournamentQa(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=badugi&mgxQa=mobile`);
  await waitForE2EDriver(page);
  await page.evaluate(() => window.__BADUGI_E2E__?.startTournamentMTT?.());
  await page
    .locator('[data-testid="tournament-hud"], [data-testid="mtt-hud"]')
    .waitFor({ state: "visible", timeout: 20000 });
}

test("Badugi physical mobile waiting freeze fixture recovers from BET Draw2 no-pending state", async ({
  page,
}) => {
  test.setTimeout(120000);
  await openBadugiTournamentQa(page);

  await page.evaluate(() => window.__BADUGI_E2E__?.setupBadugiWaitingFreezeFixtureForTest?.());
  await expect(page.getByTestId("mobile-qa-debug-panel")).toBeVisible({ timeout: 10000 });

  const before = await page.evaluate(() =>
    window.__MGX_EXPORT_FREEZE_REPORT__?.({
      label: "before-auto-recovery",
      mode: "tournament",
    }),
  );

  await page.waitForTimeout(3200);
  const after = await page.evaluate(() =>
    window.__MGX_EXPORT_FREEZE_REPORT__?.({
      label: "after-auto-recovery",
      mode: "tournament",
    }),
  );

  ensureDirs();
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    before,
    after,
    reportPath: REPORT_PATH,
    screenshotPath: SCREENSHOT_PATH,
  };
  writeReport(payload);

  expect(before?.classification).toBe("WAITING_WITH_NO_PENDING_ACTORS");
  expect(after?.classification, JSON.stringify(payload, null, 2)).not.toBe(
    "WAITING_WITH_NO_PENDING_ACTORS",
  );
  expect(after?.phase, JSON.stringify(payload, null, 2)).not.toBe("BET");
  expect(after?.waitingForOtherPlayers, JSON.stringify(payload, null, 2)).toBe(false);
});
