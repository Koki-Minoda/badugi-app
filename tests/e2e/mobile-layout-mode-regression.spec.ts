import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/ui/mobile-layout-policy");
const SCREENSHOT_DIR = path.join(REPORT_DIR, "screenshots");
const REPORT_PATH = path.join(REPORT_DIR, "mobile-layout-mode-regression.json");

const VIEWPORTS = [
  { mode: "mobile-portrait", width: 390, height: 844 },
  { mode: "mobile-landscape", width: 844, height: 390 },
] as const;

const SCENARIOS = [
  { variant: "badugi", gameMode: "tournament", heroCardTestId: "player-0-card-3", requiresActions: true },
  { variant: "D01", gameMode: "tournament", heroCardTestId: "player-0-card-4", requiresActions: false },
  { variant: "badugi", gameMode: "cash", heroCardTestId: "player-0-card-3", requiresActions: false },
  { variant: "D01", gameMode: "cash", heroCardTestId: "player-0-card-4", requiresActions: false },
] as const;

function ensureDirs() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function openScenario(page: Page, scenario: (typeof SCENARIOS)[number]) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=${scenario.variant}&mode=${scenario.gameMode}&mgxQa=mobile`);
  await waitForE2EDriver(page);
  if (scenario.gameMode === "tournament") {
    if (scenario.variant === "badugi") {
      await invokeE2E(page, "setupMobileTournamentHeroActionFixtureForTest", { variantId: scenario.variant });
    } else {
      await invokeE2E(page, "startTournamentMTT", {
        id: `mobile-layout-${scenario.variant}`,
        name: `${scenario.variant} Mobile Layout`,
        tables: 1,
        seatsPerTable: 6,
        startingStack: 5000,
        gameVariant: scenario.variant,
        gameRotation: [scenario.variant],
        rotationPolicy: "fixed",
        levels: [{ levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 999 }],
        payouts: [{ place: 1, percent: 100 }],
      });
    }
  }
  await expect(page.getByTestId("game-table-surface")).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 10000 });
}

async function collectModeState(page: Page, heroCardTestId: string) {
  return page.evaluate((cardId) => {
    const root = document.querySelector("[data-layout-mode]");
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
    const viewport = {
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    };
    const actionButtons = ["action-call", "action-check", "action-raise", "action-fold", "action-draw-selected"]
      .map((testId) => ({ testId, box: rectFor(testId) }))
      .filter((entry) => entry.box);
    return {
      layoutMode: root?.getAttribute("data-layout-mode") ?? null,
      rootClasses: root?.className ?? "",
      viewport,
      table: rectFor("game-table-surface"),
      decision: rectFor("decision-panel"),
      heroCard: rectFor(cardId),
      hud: rectFor("tournament-hud"),
      actionButtons,
      overflow: {
        horizontal: document.documentElement.scrollWidth - window.innerWidth,
        vertical: document.documentElement.scrollHeight - window.innerHeight,
      },
    };
  }, heroCardTestId);
}

function expectBoxInside(label: string, box: Awaited<ReturnType<typeof collectModeState>>["table"], viewport: { width: number; height: number }) {
  expect(box, `${label} visible`).toBeTruthy();
  expect(box!.left, `${label} left`).toBeGreaterThanOrEqual(-1);
  expect(box!.top, `${label} top`).toBeGreaterThanOrEqual(-1);
  expect(box!.right, `${label} right`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.bottom, `${label} bottom`).toBeLessThanOrEqual(viewport.height + 1);
}

test.describe("explicit mobile portrait and landscape layout modes", () => {
  test.describe.configure({ timeout: 180000 });
  const rows: unknown[] = [];

  test.afterAll(() => {
    ensureDirs();
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2)}\n`);
  });

  for (const viewport of VIEWPORTS) {
    for (const scenario of SCENARIOS) {
      test(`${scenario.variant} ${scenario.gameMode} uses ${viewport.mode}`, async ({ page }) => {
        ensureDirs();
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await openScenario(page, scenario);
        const state = await collectModeState(page, scenario.heroCardTestId);
        const screenshotPath = path.join(
          SCREENSHOT_DIR,
          `${scenario.variant.toLowerCase()}-${scenario.gameMode}-${viewport.mode}.png`,
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        rows.push({ ...scenario, viewport: viewport.mode, status: "PASS", screenshotPath, state });

        expect(state.layoutMode).toBe(viewport.mode);
        expect(state.rootClasses).toContain(viewport.mode);
        expect(state.overflow.horizontal, "no horizontal overflow").toBeLessThanOrEqual(2);
        expectBoxInside("table", state.table, state.viewport);
        expectBoxInside("decision panel", state.decision, state.viewport);
        expectBoxInside("hero card", state.heroCard, state.viewport);
        if (scenario.requiresActions) {
          expect(state.actionButtons.length, "visible legal action buttons").toBeGreaterThanOrEqual(3);
          for (const button of state.actionButtons) {
            expectBoxInside(button.testId, button.box, state.viewport);
          }
        }
      });
    }
  }
});
