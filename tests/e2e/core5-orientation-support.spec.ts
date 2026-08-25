import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  APP_URL,
  createAuthenticatedSession,
  dismissTranslateOverlay,
  enterTitleIfPresent,
  gotoWithRetry,
  openAuthenticatedGame,
} from "./authHelper";

const REPORT_PATH = path.resolve("reports/alpha/core5-orientation-support.json");

const CORE5 = [
  { game: "Badugi", variantId: "badugi", title: /Badugi/i, requiresPreview: true },
  { game: "2-7 Triple Draw", variantId: "D01", title: /2-7 Triple Draw/i },
  { game: "A-5 Triple Draw", variantId: "D02", title: /A-5 Triple Draw/i },
  { game: "2-7 Single Draw", variantId: "S01", title: /2-7 Single Draw/i },
  { game: "A-5 Single Draw", variantId: "S02", title: /A-5 Single Draw/i },
] as const;

const VIEWPORTS = [
  { name: "portrait", width: 390, height: 844 },
  { name: "landscape", width: 844, height: 390 },
] as const;

async function openMobile(browser: Browser, viewport: (typeof VIEWPORTS)[number]) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
  });
  return { context, page: await context.newPage() };
}

async function closeContext(context: BrowserContext) {
  await context.close().catch(() => {});
}

async function allowPreviewIfNeeded(page: Page, requiresPreview?: boolean) {
  if (!requiresPreview) return;
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
}

async function assertUsableCore5Game(page: Page) {
  await expect(page.getByText("Landscape mode required")).toHaveCount(0);
  await expect(page.getByText("MGXはスマホ横画面に最適化されています")).toHaveCount(0);
  await expect(page.locator(".mgx-mobile-landscape")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("table-total-pot")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("table-phase-badge")).toBeVisible({ timeout: 20000 });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
}

async function openTournamentGame(page: Page, variantId: string) {
  await createAuthenticatedSession(page);
  await gotoWithRetry(page, `${APP_URL}?mode=store_tournament&variant=${variantId}`);
  await dismissTranslateOverlay(page);
  await enterTitleIfPresent(page);
}

test.describe("Core 5 orientation support", () => {
  test.describe.configure({ timeout: 180000 });

  const rows: any[] = [];

  test.afterAll(() => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(
      REPORT_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          status: rows.every((row) => row.status === "PASS") ? "PASS" : "FAIL",
          rows,
        },
        null,
        2,
      )}\n`,
    );
  });

  for (const entry of CORE5) {
    for (const viewport of VIEWPORTS) {
      test(`${entry.game} cash mode supports ${viewport.name}`, async ({ browser }) => {
        const { context, page } = await openMobile(browser, viewport);
        try {
          await allowPreviewIfNeeded(page, Boolean("requiresPreview" in entry && entry.requiresPreview));
          await openAuthenticatedGame(page, `${APP_URL}?variant=${entry.variantId}`);
          await assertUsableCore5Game(page);
          rows.push({
            game: entry.game,
            variantId: entry.variantId,
            mode: "cash",
            viewport: viewport.name,
            status: "PASS",
          });
        } finally {
          await closeContext(context);
        }
      });

      test(`${entry.game} tournament mode supports ${viewport.name}`, async ({ browser }) => {
        const { context, page } = await openMobile(browser, viewport);
        try {
          await allowPreviewIfNeeded(page, Boolean("requiresPreview" in entry && entry.requiresPreview));
          await openTournamentGame(page, entry.variantId);
          await assertUsableCore5Game(page);
          rows.push({
            game: entry.game,
            variantId: entry.variantId,
            mode: "tournament",
            viewport: viewport.name,
            status: "PASS",
          });
        } finally {
          await closeContext(context);
        }
      });
    }
  }
});
