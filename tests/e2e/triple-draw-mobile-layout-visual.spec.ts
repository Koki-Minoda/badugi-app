import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import {
  expectMobileActionsInViewport,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

const SCREENSHOT_DIR = path.resolve("reports/screenshots");
const REPORT_PATH = path.resolve("reports/alpha/triple-draw-mobile-layout-visual.json");

const VARIANTS = [
  { variant: "S02" },
  { variant: "D02" },
  { variant: "S01" },
] as const;

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844, screenshot: true },
  { name: "430x932", width: 430, height: 932, screenshot: false },
  { name: "844x390", width: 844, height: 390, screenshot: false },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(
      async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      { timeout: 10000 },
    )
    .toBeLessThanOrEqual(2);
}

async function boxFor(page: Page, testId: string) {
  return page.getByTestId(testId).first().boundingBox();
}

function overlapRatio(a: Awaited<ReturnType<typeof boxFor>>, b: Awaited<ReturnType<typeof boxFor>>) {
  if (!a || !b) return 0;
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const overlap = x * y;
  const smaller = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
  return overlap / smaller;
}

test.describe("Triple Draw mobile layout visual gate", () => {
  test.describe.configure({ timeout: 180000 });

  const rows: any[] = [];

  test.afterAll(() => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(
      REPORT_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          status: rows.every((row) => row.status === "PASS") ? "PASS" : "FAIL",
          rows,
        },
        null,
        2,
      ),
    );
  });

  for (const { variant } of VARIANTS) {
    for (const viewport of VIEWPORTS) {
      test(`${variant} ${viewport.name} keeps cards, pot, and controls readable`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
        await waitForE2EDriver(page);

        await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
        await expect(page.getByTestId("table-total-pot")).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId("table-phase-badge")).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId("seat-0")).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId("player-0-card-4")).toBeVisible({ timeout: 10000 });
        await expectMobileActionsInViewport(page);
        await expectNoHorizontalOverflow(page);

        const potBox = await boxFor(page, "table-total-pot");
        const heroBox = await boxFor(page, "seat-0");
        const decisionBox = await boxFor(page, "decision-panel");
        const heroPotOverlap = overlapRatio(potBox, heroBox);
        const potControlsOverlap = overlapRatio(potBox, decisionBox);

        expect(heroPotOverlap).toBeLessThan(0.15);
        expect(potControlsOverlap).toBe(0);

        let screenshotPath: string | null = null;
        if (viewport.screenshot) {
          fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
          screenshotPath = path.join(
            SCREENSHOT_DIR,
            `triple-draw-mobile-layout-${variant.toLowerCase()}-${viewport.name}.png`,
          );
          await page.screenshot({ path: screenshotPath, fullPage: true });
        }

        rows.push({
          variant,
          viewport: viewport.name,
          heroPotOverlap,
          potControlsOverlap,
          screenshotPath,
          status: "PASS",
        });
      });
    }
  }
});
