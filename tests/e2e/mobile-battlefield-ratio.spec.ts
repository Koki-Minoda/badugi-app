import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/ui/mobile-layout-policy");
const SCREENSHOT_DIR = path.join(REPORT_DIR, "screenshots");
const REPORT_PATH = path.join(REPORT_DIR, "mobile-battlefield-ratio.json");

const VIEWPORTS = [
  { name: "portrait", width: 390, height: 844, axis: "height", minRatio: 0.7 },
  { name: "landscape", width: 844, height: 390, axis: "width", minRatio: 0.7 },
] as const;

const VARIANTS = [
  { id: "badugi", heroCardTestId: "player-0-card-3", requiresActions: true },
  { id: "D01", heroCardTestId: "player-0-card-4", requiresActions: false },
] as const;

function ensureDirs() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function openTournament(page: Page, variantId: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variantId}&mode=tournament&mgxQa=mobile`);
  await waitForE2EDriver(page);
  if (variantId === "badugi") {
    await invokeE2E(page, "setupMobileTournamentHeroActionFixtureForTest", { variantId });
  } else {
    await invokeE2E(page, "startTournamentMTT", {
      id: "mobile-battlefield-d01",
      name: "D01 Mobile Battlefield",
      tables: 1,
      seatsPerTable: 6,
      startingStack: 5000,
      gameVariant: "D01",
      gameRotation: ["D01"],
      rotationPolicy: "fixed",
      levels: [{ levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 999 }],
      payouts: [{ place: 1, percent: 100 }],
    });
  }
  await expect(page.getByTestId("game-table-surface")).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 10000 });
}

async function collectBattlefieldMetrics(page: Page, heroCardTestId: string) {
  return page.evaluate((cardId) => {
    const rectFor = (testId: string) => {
      const element = document.querySelector(`[data-testid="${testId}"]`);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const overlaps = (a: ReturnType<typeof rectFor>, b: ReturnType<typeof rectFor>) => {
      if (!a || !b) return false;
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return x * y > 8;
    };
    const viewport = {
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    };
    const table = rectFor("game-table-surface");
    const decision = rectFor("decision-panel");
    const hud = rectFor("tournament-hud");
    const heroCard = rectFor(cardId);
    const pot = rectFor("table-total-pot");
    const phase = rectFor("table-phase-badge");
    const buttons = ["action-call", "action-check", "action-raise", "action-fold", "action-draw-selected"]
      .map((testId) => ({ testId, box: rectFor(testId) }))
      .filter((entry) => entry.box);
    return {
      layoutMode: document.querySelector("[data-layout-mode]")?.getAttribute("data-layout-mode") ?? null,
      viewport,
      table,
      decision,
      hud,
      heroCard,
      pot,
      phase,
      buttons,
      ratios: {
        height: table ? table.height / Math.max(1, viewport.height) : 0,
        width: table ? table.width / Math.max(1, viewport.width) : 0,
        hudHeight: hud ? hud.height / Math.max(1, viewport.height) : 0,
      },
      overlap: {
        hudHeroCard: overlaps(hud, heroCard),
        controlsHeroCard: overlaps(decision, heroCard),
      },
      overflow: {
        horizontal: document.documentElement.scrollWidth - window.innerWidth,
        vertical: document.documentElement.scrollHeight - window.innerHeight,
      },
    };
  }, heroCardTestId);
}

function expectVisibleBox(label: string, box: Awaited<ReturnType<typeof collectBattlefieldMetrics>>["table"], viewport: { width: number; height: number }) {
  expect(box, `${label} visible`).toBeTruthy();
  expect(box!.left, `${label} left`).toBeGreaterThanOrEqual(-1);
  expect(box!.top, `${label} top`).toBeGreaterThanOrEqual(-1);
  expect(box!.right, `${label} right`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.bottom, `${label} bottom`).toBeLessThanOrEqual(viewport.height + 1);
}

test.describe("mobile battlefield ratio policy", () => {
  test.describe.configure({ timeout: 180000 });
  const rows: unknown[] = [];

  test.afterAll(() => {
    ensureDirs();
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2)}\n`);
  });

  for (const viewport of VIEWPORTS) {
    for (const variant of VARIANTS) {
      test(`${variant.id} tournament ${viewport.name} keeps battlefield dominant`, async ({ page }) => {
        ensureDirs();
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await openTournament(page, variant.id);
        const metrics = await collectBattlefieldMetrics(page, variant.heroCardTestId);
        const screenshotPath = path.join(
          SCREENSHOT_DIR,
          `${variant.id.toLowerCase()}-tournament-${viewport.name}-battlefield.png`,
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        rows.push({ variant: variant.id, viewport: viewport.name, status: "PASS", screenshotPath, metrics });

        expect(metrics.ratios[viewport.axis], `${viewport.name} battlefield ${viewport.axis} ratio`).toBeGreaterThanOrEqual(viewport.minRatio);
        expect(metrics.overflow.horizontal, "no horizontal overflow").toBeLessThanOrEqual(2);
        expect(metrics.overflow.vertical, "no vertical overflow").toBeLessThanOrEqual(2);
        expectVisibleBox("table", metrics.table, metrics.viewport);
        expectVisibleBox("hero card", metrics.heroCard, metrics.viewport);
        expectVisibleBox("pot", metrics.pot, metrics.viewport);
        expectVisibleBox("phase", metrics.phase, metrics.viewport);
        expectVisibleBox("decision panel", metrics.decision, metrics.viewport);
        expect(metrics.overlap.hudHeroCard, "HUD must not overlap Hero cards").toBe(false);
        expect(metrics.overlap.controlsHeroCard, "controls must not overlap Hero cards").toBe(false);
        if (variant.requiresActions) {
          expect(metrics.buttons.length, "visible legal action buttons").toBeGreaterThanOrEqual(3);
          for (const button of metrics.buttons) {
            expectVisibleBox(button.testId, button.box, metrics.viewport);
          }
        }
      });
    }
  }
});
