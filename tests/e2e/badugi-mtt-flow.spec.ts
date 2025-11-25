import { test, expect, Page } from "@playwright/test";

const APP_URL = "http://127.0.0.1:3000/";

async function gotoWithRetry(page: Page, url: string, timeout = 60000) {
  const deadline = Date.now() + timeout;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      await page.goto(url, { waitUntil: "load", timeout: Math.min(15000, timeout) });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1000);
    }
  }
  throw lastError ?? new Error(`Failed to load ${url} within ${timeout}ms`);
}

async function dismissTranslateOverlay(page: Page) {
  const translateBubble = page.locator("text=Google Translate");
  if (await translateBubble.count()) {
    await translateBubble.click().catch(() => {});
  }
  const closeButtons = page.locator('button:has-text("\u9589\u3058\u308b")');
  if (await closeButtons.count()) {
    await closeButtons.first().click().catch(() => {});
  }
}

async function openGameSurface(page: Page) {
  await gotoWithRetry(page, APP_URL);
  await dismissTranslateOverlay(page);
  const startButton = page.getByRole("button", { name: /start/i }).first();
  try {
    await startButton.waitFor({ state: "visible", timeout: 15000 });
    await startButton.click();
  } catch {
    // already past the start screen
  }
  await page.goto(`${APP_URL}game`, { waitUntil: "load" });
}

async function waitForE2EDriver(page: Page) {
  const REQUIRED_METHODS = [
    "forceSeatAction",
    "forceSequentialFolds",
    "forceAllIn",
    "resolveHandNow",
    "dealNewHandNow",
    "fastForwardMTTComplete",
    "getTournamentReplay",
  ];
  await page.waitForFunction(
    (expected) => {
      const api = window.__BADUGI_E2E__;
      if (!api || typeof api !== "object") return false;
      return expected.every((key) => typeof api[key] === "function");
    },
    REQUIRED_METHODS,
    { timeout: 60000 },
  );
}

async function waitForE2EHelper(page: Page, helperName: string) {
  await page.waitForFunction(
    (method) => typeof window.__BADUGI_E2E__?.[method] === "function",
    helperName,
    { timeout: 20000 },
  );
}

async function invokeE2E(page: Page, method: string, ...args: unknown[]) {
  return page.evaluate(
    async ({ methodName, params }) => {
      const api = window.__BADUGI_E2E__;
      if (!api || typeof api[methodName] !== "function") {
        throw new Error(`E2E helper ${methodName} is not available`);
      }
      return await api[methodName](...params);
    },
    { methodName: method, params: args },
  );
}

async function startStoreTournament(page: Page) {
  await openGameSurface(page);
  await waitForE2EDriver(page);
  await waitForE2EHelper(page, "fastForwardMTTComplete");
  await invokeE2E(page, "startTournamentMTT");
  await page.locator('[data-testid="mtt-hud"]').waitFor({ state: "visible", timeout: 15000 });
}

async function getHudSnapshot(page: Page) {
  return page.evaluate(() => window.__BADUGI_E2E__?.getTournamentHudState?.() ?? null);
}

async function waitForTournamentOverlay(page: Page) {
  const overlay = page.locator('[data-testid="mtt-result-overlay"]');
  await overlay.waitFor({ state: "visible", timeout: 30000 });
  return overlay;
}

async function waitForHeroBustOverlay(page: Page) {
  const overlay = page.locator('[data-testid="mtt-hero-bust-overlay"]');
  await overlay.waitFor({ state: "visible", timeout: 20000 });
  return overlay;
}

function parsePayout(text: string) {
  const match = text.match(/(-?\d+)/);
  return match ? Number(match[1]) : 0;
}

test.describe.configure({ timeout: 120000 });

test.describe("Badugi MTT flow", () => {
  test("MTT runs to completion and shows final results", async ({ page }) => {
    await startStoreTournament(page);
    const initialHud = await getHudSnapshot(page);
    expect(initialHud).toBeTruthy();
    const totalEntrants = initialHud?.totalPlayers ?? 0;

    await invokeE2E(page, "fastForwardMTTComplete");
    const heroOverlay = page.locator('[data-testid="mtt-hero-bust-overlay"]');
    const heroOverlayVisible = await heroOverlay
      .waitFor({ state: "visible", timeout: 1000 })
      .then(() => true)
      .catch(() => false);

    const placements = await invokeE2E(page, "getTournamentPlacements");
    expect(placements).toHaveLength(totalEntrants);
    const sortedPlacements = [...placements].sort((a, b) => a.place - b.place);
    expect(sortedPlacements[0].payout).toBeGreaterThan(0);
    expect(sortedPlacements[1].payout).toBeGreaterThan(0);
    expect(sortedPlacements[2].payout).toBeGreaterThan(0);
    expect(sortedPlacements.slice(3).every((entry) => entry.payout === 0)).toBe(true);

    if (heroOverlayVisible) {
      const heroSummary = await heroOverlay
        .locator('[data-testid="mtt-hero-bust-hero-summary"]')
        .textContent();
      expect(heroSummary).toMatch(/You finished in \d+(st|nd|rd|th) place/);
    } else {
      const overlay = await waitForTournamentOverlay(page);
      const rows = overlay.locator('[data-testid="mtt-result-row"]');
      await expect(rows).toHaveCount(totalEntrants);

      const placeNumbers = (await overlay
        .locator('[data-testid="mtt-result-place"]')
        .allTextContents()).map((text) => Number(text.trim()));
      const sortedPlaces = [...placeNumbers].sort((a, b) => a - b);
      expect(placeNumbers).toEqual(sortedPlaces);
      expect(sortedPlaces[0]).toBe(1);
      expect(sortedPlaces[sortedPlaces.length - 1]).toBe(sortedPlaces.length);

      const payoutNumbers = (await overlay
        .locator('[data-testid="mtt-result-payout"]')
        .allTextContents()).map((text) => parsePayout(text));
      expect(payoutNumbers[0]).toBeGreaterThan(0);
      expect(payoutNumbers[1]).toBeGreaterThan(0);
      expect(payoutNumbers[2]).toBeGreaterThan(0);
      expect(payoutNumbers.slice(3).every((value) => value === 0)).toBe(true);

      const champion = await overlay.locator('[data-testid="mtt-result-row"]').first();
      await expect(
        champion.locator('[data-testid="mtt-result-place"]'),
      ).toHaveText("1");
    }

    const replay = await invokeE2E(page, "getTournamentReplay");
    expect(replay).toBeTruthy();
    expect(replay.config.name).toMatch(/Tournament/i);
    expect(Array.isArray(replay.hands)).toBe(true);
    expect(replay.hands.length).toBeGreaterThan(0);
    expect(replay.finalState.placements).toHaveLength(totalEntrants);
  });

  test("Hero bust overlay shows in-the-money summary", async ({ page }) => {
    await startStoreTournament(page);
    await invokeE2E(page, "forceHeroBust");
    const overlay = await waitForHeroBustOverlay(page);
    await expect(overlay.locator('[data-testid="mtt-hero-bust-hero-summary"]')).toBeVisible();
    const itmRows = overlay.locator('[data-testid="mtt-hero-bust-itm-row"]');
    await expect(itmRows).toHaveCount(3);
    const heroText = await overlay
      .locator('[data-testid="mtt-hero-bust-hero-summary"]')
      .textContent();
    expect(heroText).toMatch(/You finished in \d+(st|nd|rd|th) place/);
    await overlay.getByRole("button", { name: /back to menu/i }).click();
  });
});
