import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/ui/readability");
const SUMMARY_PATH = path.join(REPORT_DIR, "tournament-busted-seat-readability.json");
const SCREENSHOT_PATH = path.resolve("reports/screenshots/readability/tournament-busted-seat-readability.png");

function ensureDirs() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(SCREENSHOT_PATH), { recursive: true });
}

async function box(page: Page, selector: string) {
  const locator = page.locator(selector).first();
  if (!(await locator.isVisible().catch(() => false))) return null;
  return locator.boundingBox();
}

function overlaps(a: Awaited<ReturnType<typeof box>>, b: Awaited<ReturnType<typeof box>>) {
  if (!a || !b) return false;
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y > 12;
}

test("busted tournament CPU seats move to rail and do not block mobile table", async ({ page }) => {
  ensureDirs();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=badugi&mode=tournament&mgxQa=mobile`);
  await waitForE2EDriver(page);

  const fixture = await invokeE2E(page, "setupTournamentBustedSeatDisplayFixtureForTest");
  await expect(page.getByTestId("tournament-eliminated-rail")).toBeVisible({ timeout: 10000 });
  await page.getByTestId("tournament-eliminated-rail").getByRole("button", { name: /rail/i }).click();
  await expect(page.getByTestId("eliminated-rail-entry-cpu-2")).toBeVisible();
  await expect(page.getByTestId("eliminated-rail-entry-cpu-4")).toBeVisible();
  await expect(page.getByTestId("seat-2")).toHaveCount(0);
  await expect(page.getByTestId("seat-4")).toHaveCount(0);
  await expect(page.getByTestId("seat-0")).toBeVisible();
  await expect(page.getByTestId("seat-5")).toBeVisible();

  const potBox = await box(page, '[data-testid="table-total-pot"]');
  const railBox = await box(page, '[data-testid="tournament-eliminated-rail"]');
  const heroBox = await box(page, '[data-testid="seat-0"]');
  const decisionBox = await box(page, '[data-testid="decision-panel"]');

  const metrics = {
    fixtureHandId: fixture?.handId ?? null,
    potOverlapsRail: overlaps(potBox, railBox),
    heroOverlapsRail: overlaps(heroBox, railBox),
    decisionPanelVisible: Boolean(decisionBox),
  };

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  fs.writeFileSync(
    SUMMARY_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), metrics }, null, 2)}\n`,
  );

  expect(metrics.potOverlapsRail).toBe(false);
  expect(metrics.heroOverlapsRail).toBe(false);
  expect(metrics.decisionPanelVisible).toBe(true);
});
