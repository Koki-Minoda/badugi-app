import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

async function openMobileLandscape(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  return { context, page: await context.newPage() };
}

async function closeContext(context: BrowserContext) {
  await context.close().catch(() => {});
}

test.describe("responsive game layout separation", () => {
  test.describe.configure({ timeout: 120000 });

  test("desktop keeps desktop chrome, side ledger, and non-mobile table sizing", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page);

    await expect(page.locator(".mgx-mobile-landscape")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /ゲーム選択|Game Select|Title/i })).toBeVisible();
    await expect(page.getByTestId("table-status-ledger")).toBeVisible();
    await expect(page.getByTestId("decision-panel")).toBeVisible();

    const metrics = await page.evaluate(() => ({
      bodyOverflow: getComputedStyle(document.body).overflow,
      horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 2,
    }));
    expect(metrics.bodyOverflow).not.toBe("hidden");
    expect(metrics.horizontalScroll).toBe(false);
  });

  test("mobile landscape uses fixed mobile root and hides desktop-only chrome", async ({ browser }) => {
    const { context, page } = await openMobileLandscape(browser);
    try {
      await page.addInitScript(() => {
        window.localStorage.setItem("mgx.previewVariants", "true");
      });
      await openAuthenticatedGame(page, `${APP_URL}?variant=badugi`);

      await expect(page.locator(".mgx-mobile-landscape")).toBeVisible();
      await expect(page.getByTestId("table-status-ledger")).toHaveCount(0);
      await expect(page.getByTestId("decision-panel")).toBeVisible();

      const metrics = await page.evaluate(() => ({
        htmlOverflow: getComputedStyle(document.documentElement).overflow,
        bodyOverflow: getComputedStyle(document.body).overflow,
        horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 2,
        verticalScroll: document.documentElement.scrollHeight > window.innerHeight + 2,
      }));
      expect(metrics.htmlOverflow).toBe("hidden");
      expect(metrics.bodyOverflow).toBe("hidden");
      expect(metrics.horizontalScroll).toBe(false);
      expect(metrics.verticalScroll).toBe(false);

      const decisionBox = await page.getByTestId("decision-panel").boundingBox();
      const heroCardBox = await page.getByTestId("player-0-card-0").boundingBox();
      expect(decisionBox).not.toBeNull();
      expect(heroCardBox).not.toBeNull();
      expect((decisionBox?.x ?? 9999) + (decisionBox?.width ?? 0)).toBeLessThanOrEqual(844);
      expect((heroCardBox?.y ?? 9999) + (heroCardBox?.height ?? 0)).toBeLessThanOrEqual(390);
    } finally {
      await closeContext(context);
    }
  });

  test("mobile portrait allows Core 5 gameplay without a hard orientation block", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();
    try {
      await openAuthenticatedGame(page, `${APP_URL}?variant=D01`);

      await expect(page.getByText("Landscape mode required")).toHaveCount(0);
      await expect(page.getByText("MGXはスマホ横画面に最適化されています")).toHaveCount(0);
      await expect(page.locator(".mgx-mobile-landscape")).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId("decision-panel")).toBeVisible();
    } finally {
      await closeContext(context);
    }
  });
});
