import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_PATH = path.resolve("reports/ui/mobile-tournament-readability.json");
const SCREENSHOT_DIR = path.resolve("reports/screenshots/mobile-readability");

const VIEWPORTS = [
  { name: "portrait", width: 390, height: 844, minBattlefieldRatio: 0.55, maxHudRatio: 0.095 },
  { name: "landscape", width: 844, height: 390, minBattlefieldRatio: 0.92, maxHudRatio: 0.16 },
] as const;

const VARIANTS = [
  { id: "badugi", heroCardTestId: "player-0-card-3" },
  { id: "D01", heroCardTestId: "player-0-card-4" },
] as const;

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
} | null;

function ensureDirs() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function openMobileTournamentFixture(page: Page, variantId: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variantId}&mode=tournament&mgxQa=mobile`);
  await waitForE2EDriver(page);
  if (variantId === "D01") {
    await invokeE2E(page, "startTournamentMTT", {
      id: "mobile-readability-d01",
      name: "D01 Mobile Readability",
      tables: 1,
      seatsPerTable: 6,
      startingStack: 5000,
      gameVariant: "D01",
      gameRotation: ["D01"],
      rotationPolicy: "fixed",
      levels: [{ levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 999 }],
      payouts: [{ place: 1, percent: 100 }],
    });
  } else {
    await invokeE2E(page, "setupMobileTournamentHeroActionFixtureForTest", { variantId });
  }
  await expect(page.getByTestId("game-table-surface")).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("tournament-hud")).toBeVisible({ timeout: 10000 });
}

function intersects(a: Rect, b: Rect) {
  if (!a || !b) return false;
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y > 8;
}

async function collectMetrics(page: Page, heroCardTestId: string) {
  return page.evaluate((heroCardId) => {
    const rectFor = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      };
    };
    const viewport = {
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    };
    const table = rectFor('[data-testid="game-table-surface"]');
    const hud = rectFor('[data-testid="tournament-hud"]');
    const heroSeat = rectFor('[data-testid="seat-0"]');
    const heroCard = rectFor(`[data-testid="${heroCardId}"]`);
    const pot = rectFor('[data-testid="table-total-pot"]');
    const phase = rectFor('[data-testid="table-phase-badge"]');
    const decision = rectFor('[data-testid="decision-panel"]');
    const actionButtons = [
      "action-call",
      "action-check",
      "action-raise",
      "action-fold",
      "action-draw-selected",
    ]
      .map((testId) => ({ testId, box: rectFor(`[data-testid="${testId}"]`) }))
      .filter((entry) => entry.box);
    const tableCenter = table
      ? {
          x: table.left + table.width * 0.38,
          y: table.top + table.height * 0.34,
          width: table.width * 0.24,
          height: table.height * 0.32,
          top: table.top + table.height * 0.34,
          right: table.left + table.width * 0.62,
          bottom: table.top + table.height * 0.66,
          left: table.left + table.width * 0.38,
        }
      : null;
    return {
      viewport,
      table,
      hud,
      heroSeat,
      heroCard,
      pot,
      phase,
      decision,
      actionButtons,
      tableCenter,
      battlefieldRatio: table ? table.height / Math.max(1, viewport.height) : 0,
      hudRatio: hud ? hud.height / Math.max(1, viewport.height) : 1,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      verticalOverflow: document.documentElement.scrollHeight - window.innerHeight,
      railText: document.querySelector('[data-testid="tournament-eliminated-rail"]')?.textContent?.trim() ?? null,
      phaseText: document.querySelector('[data-testid="table-phase-badge"]')?.textContent?.trim() ?? null,
    };
  }, heroCardTestId);
}

function expectInsideViewport(label: string, box: Rect, viewport: { width: number; height: number }) {
  expect(box, `${label} should be visible`).toBeTruthy();
  expect(box!.left, `${label} left`).toBeGreaterThanOrEqual(-1);
  expect(box!.top, `${label} top`).toBeGreaterThanOrEqual(-1);
  expect(box!.right, `${label} right`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.bottom, `${label} bottom`).toBeLessThanOrEqual(viewport.height + 1);
}

test.describe("mobile tournament readability density", () => {
  test.describe.configure({ timeout: 180000 });
  const rows: unknown[] = [];

  test.afterAll(() => {
    ensureDirs();
    fs.writeFileSync(
      REPORT_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          policy: {
            portraitBattlefieldMin: 0.55,
            landscapeBattlefieldMin: 0.92,
            hudCompact: true,
          },
          rows,
        },
        null,
        2,
      )}\n`,
    );
  });

  for (const variant of VARIANTS) {
    for (const viewport of VIEWPORTS) {
      test(`${variant.id} tournament ${viewport.name} preserves table battlefield`, async ({ page }) => {
        ensureDirs();
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await openMobileTournamentFixture(page, variant.id);
        const metrics = await collectMetrics(page, variant.heroCardTestId);
        const screenshotPath = path.join(SCREENSHOT_DIR, `${variant.id.toLowerCase()}-${viewport.name}-actor-state.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        rows.push({
          variant: variant.id,
          viewport: viewport.name,
          status: "PASS",
          screenshotPath,
          metrics,
        });

        expect(metrics.horizontalOverflow, "no horizontal overflow").toBeLessThanOrEqual(2);
        expect(metrics.verticalOverflow, "no vertical overflow").toBeLessThanOrEqual(2);
        expect(metrics.battlefieldRatio, "table battlefield ratio").toBeGreaterThanOrEqual(viewport.minBattlefieldRatio);
        expect(metrics.hudRatio, "compact tournament HUD height ratio").toBeLessThanOrEqual(viewport.maxHudRatio);
        expectInsideViewport("table", metrics.table, metrics.viewport);
        expectInsideViewport("table center", metrics.tableCenter, metrics.viewport);
        expectInsideViewport("pot", metrics.pot, metrics.viewport);
        expectInsideViewport("phase", metrics.phase, metrics.viewport);
        expectInsideViewport("hero seat", metrics.heroSeat, metrics.viewport);
        expectInsideViewport("hero card", metrics.heroCard, metrics.viewport);
        expectInsideViewport("decision panel", metrics.decision, metrics.viewport);
        const expectedActionButtonCount = variant.id === "badugi" ? 3 : 0;
        expect(metrics.actionButtons.length, "visible action buttons").toBeGreaterThanOrEqual(expectedActionButtonCount);
        for (const button of metrics.actionButtons) {
          expectInsideViewport(button.testId, button.box, metrics.viewport);
        }
        expect(intersects(metrics.hud, metrics.heroCard), "HUD must not overlap Hero cards").toBe(false);
        expect(intersects(metrics.decision, metrics.heroCard), "controls must not overlap Hero cards").toBe(false);
      });
    }
  }

  test("Badugi tournament showdown state keeps Hero cards visible", async ({ page }) => {
    ensureDirs();
    await page.setViewportSize({ width: 390, height: 844 });
    await openMobileTournamentFixture(page, "badugi");
    await invokeE2E(page, "resolveHandNow");
    await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 10000 });
    const metrics = await collectMetrics(page, "player-0-card-3");
    const screenshotPath = path.join(SCREENSHOT_DIR, "badugi-portrait-showdown-state.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    rows.push({ variant: "badugi", viewport: "portrait", scenario: "showdown", status: "PASS", screenshotPath, metrics });
    expectInsideViewport("hero card showdown", metrics.heroCard, metrics.viewport);
    expect(intersects(metrics.hud, metrics.heroCard), "HUD must not overlap Hero cards at showdown").toBe(false);
  });
});
