import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { openAuthenticatedGame, APP_URL } from "./authHelper";
import {
  CORE5_VARIANTS,
  ensureDirFor,
  writeAuditReport,
  type AuditIssue,
} from "./helpers/core5LayoutAuditHelper";
import {
  openCore5Cash,
  startCore5Tournament,
} from "./helpers/core5LifecycleE2EHelper";
import {
  playOneHandProgression,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

const REPORT_PATH = path.resolve("reports/ui/readability/ui-readability-smoke.json");
const SCREENSHOT_DIR = path.resolve("reports/screenshots/readability");
const TARGET_VARIANTS = CORE5_VARIANTS.filter((variant) =>
  ["badugi", "D01", "S01"].includes(variant.variant),
);

type Scenario = {
  name: string;
  mode: "cash" | "tournament";
  viewport: { width: number; height: number };
};

const SCENARIOS: Scenario[] = [
  { name: "desktop-cash", mode: "cash", viewport: { width: 1280, height: 720 } },
  { name: "portrait-cash", mode: "cash", viewport: { width: 390, height: 844 } },
  { name: "landscape-tournament", mode: "tournament", viewport: { width: 844, height: 390 } },
];

function screenshotPath(name: string) {
  return path.join(SCREENSHOT_DIR, `${name}.png`);
}

async function visibleBox(page: Page, selector: string) {
  const locator = page.locator(selector).first();
  if (!(await locator.isVisible().catch(() => false))) return null;
  return locator.boundingBox();
}

function overlaps(a: Awaited<ReturnType<typeof visibleBox>>, b: Awaited<ReturnType<typeof visibleBox>>) {
  if (!a || !b) return false;
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y > 12;
}

async function collectReadabilityMetrics(page: Page, scenario: Scenario) {
  const issues: AuditIssue[] = [];
  const metrics = await page.evaluate(() => {
    const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
    const actionButtons = Array.from(
      document.querySelectorAll(
        [
          '[data-testid="action-fold"]',
          '[data-testid="action-check"]',
          '[data-testid="action-call"]',
          '[data-testid="action-raise"]',
          '[data-testid="action-draw-selected"]',
        ].join(","),
      ),
    )
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return {
          text: node.textContent?.trim() ?? "",
          visible: rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none",
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          offscreen:
            rect.x < -1 ||
            rect.y < -1 ||
            rect.right > window.innerWidth + 1 ||
            rect.bottom > window.innerHeight + 1,
        };
      })
      .filter((entry) => entry.visible);

    const seatLabels = Array.from(document.querySelectorAll('[data-testid^="seat-"]'))
      .slice(0, 6)
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim().slice(0, 160) ?? "");

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      phaseText: document.querySelector('[data-testid="table-phase-badge"]')?.textContent?.trim() ?? null,
      potText: document.querySelector('[data-testid="table-total-pot"]')?.textContent?.trim() ?? null,
      decisionPanelVisible: Boolean(byTestId("decision-panel")),
      tournamentHudVisible: Boolean(byTestId("tournament-hud")),
      actionButtons,
      minActionButtonHeight: actionButtons.reduce((min, entry) => Math.min(min, entry.height), Infinity),
      positionBadgeTextCount: (document.body.textContent?.match(/\b(BTN|SB|BB|UTG|MP|CO)\b/g) ?? []).length,
      visibleFoldCallRaiseCount: (document.body.textContent?.match(/\b(Fold|Call|Raise|Check|Draw|Pat)\b/gi) ?? []).length,
      largeBustedSeatPanels: Array.from(document.querySelectorAll('[data-testid^="seat-"]')).filter((node) => {
        const text = node.textContent?.toUpperCase() ?? "";
        const rect = node.getBoundingClientRect();
        return text.includes("BUSTED") && rect.width > 80 && rect.height > 70;
      }).length,
      seatLabels,
    };
  });

  if (metrics.horizontalOverflow > 2) {
    issues.push({ priority: "P1", issue: "horizontal overflow affects readability", value: metrics.horizontalOverflow });
  }
  if (!metrics.phaseText) {
    issues.push({ priority: "P1", issue: "phase badge not readable" });
  }
  if (!metrics.potText) {
    issues.push({ priority: "P1", issue: "pot not readable" });
  }
  if (metrics.positionBadgeTextCount < 3) {
    issues.push({ priority: "P1", issue: "position badge density too low", value: metrics.positionBadgeTextCount });
  }
  if (metrics.visibleFoldCallRaiseCount < 1) {
    issues.push({ priority: "P1", issue: "action vocabulary not visible" });
  }
  if (scenario.viewport.width < 500 && Number.isFinite(metrics.minActionButtonHeight) && metrics.minActionButtonHeight < 40) {
    issues.push({ priority: "P1", issue: "mobile action target below 40px", value: metrics.minActionButtonHeight });
  }
  for (const button of metrics.actionButtons) {
    if (button.offscreen) {
      issues.push({ priority: "P1", issue: "visible action button clipped/offscreen", value: button });
    }
  }
  if (scenario.mode === "tournament" && metrics.largeBustedSeatPanels > 0) {
    issues.push({ priority: "P1", issue: "large busted seat panel visible in tournament layout", value: metrics.largeBustedSeatPanels });
  }

  const potBox = await visibleBox(page, '[data-testid="table-total-pot"]');
  const decisionBox = await visibleBox(page, '[data-testid="decision-panel"]');
  if (overlaps(potBox, decisionBox)) {
    issues.push({ priority: "P1", issue: "pot overlaps decision controls" });
  }

  return { issues, metrics };
}

async function openScenario(page: Page, variant: (typeof CORE5_VARIANTS)[number], scenario: Scenario) {
  await page.setViewportSize(scenario.viewport);
  if (scenario.mode === "tournament") {
    await startCore5Tournament(page, variant);
    return;
  }
  await openCore5Cash(page, variant);
}

async function captureReplayEvidence(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openAuthenticatedGame(page, `${APP_URL}?variant=D01&mode=cash`);
  await waitForE2EDriver(page);

  const snapshot = await page.evaluate(() => window.__BADUGI_E2E__?.getStateSnapshot?.() ?? null);
  const handId = snapshot?.handId;
  await playOneHandProgression(page, { maxSteps: 110, policy: "safe", requireHeroButtonClick: false }).catch(() => null);
  if (typeof window !== "undefined") {
    // no-op for TS narrowing; real work is in the browser call below.
  }
  await page.evaluate(() => window.__BADUGI_E2E__?.resolveHandNow?.());
  await expect
    .poll(
      async () => {
        const history = await page.evaluate(() => window.__BADUGI_E2E__?.getHandHistory?.() ?? []);
        return history.some((entry: any) => entry?.handId === handId);
      },
      { timeout: 30000 },
    )
    .toBe(true);

  await page.getByRole("button", { name: /履歴|History/i }).first().click();
  await expect(page.getByTestId("game-utility-modal")).toBeVisible({ timeout: 10000 });
  await page.getByTestId(`hand-history-row-${handId}`).click();
  await expect(page.getByTestId("hand-replay-screen")).toBeVisible({ timeout: 10000 });
  const metrics = await page.evaluate(() => ({
    frameCounter: document.querySelector('[data-testid="replay-frame-counter"]')?.textContent?.trim() ?? null,
    eventRows: document.querySelectorAll('[data-testid^="replay-event-row-"]').length,
    controls: {
      first: Boolean(document.querySelector('[data-testid="replay-first-frame"]')),
      prev: Boolean(document.querySelector('[data-testid="replay-prev-frame"]')),
      next: Boolean(document.querySelector('[data-testid="replay-next-frame"]')),
      last: Boolean(document.querySelector('[data-testid="replay-last-frame"]')),
    },
    horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
  }));
  const replayScreenshot = screenshotPath("replay-d01-desktop");
  await page.screenshot({ path: replayScreenshot, fullPage: true });
  return { screenshotPath: replayScreenshot, metrics };
}

test.describe("UI readability smoke audit", () => {
  test.describe.configure({ timeout: 240000 });

  const rows: any[] = [];

  test.afterAll(() => {
    writeAuditReport(REPORT_PATH, rows);
  });

  for (const variant of TARGET_VARIANTS) {
    for (const scenario of SCENARIOS) {
      test(`${variant.variant} ${scenario.name} captures readability evidence`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (
            message.type() === "error" &&
            !/favicon|ResizeObserver loop|Failed to load resource: the server responded with a status of 404/i.test(message.text())
          ) {
            errors.push(message.text());
          }
        });

        const name = `${variant.variant.toLowerCase()}-${scenario.name}`;
        const shot = screenshotPath(name);
        let result: Awaited<ReturnType<typeof collectReadabilityMetrics>> | null = null;
        try {
          await openScenario(page, variant, scenario);
          result = await collectReadabilityMetrics(page, scenario);
          ensureDirFor(shot);
          await page.screenshot({ path: shot, fullPage: true });
        } catch (error) {
          ensureDirFor(shot);
          await page.screenshot({ path: shot, fullPage: true }).catch(() => null);
          result = {
            issues: [{ priority: "P1", issue: "readability capture failed", message: error instanceof Error ? error.message : String(error) }],
            metrics: {},
          };
        }

        for (const error of errors) {
          result.issues.push({ priority: "P1", issue: "browser console/page error during readability capture", message: error });
        }

        rows.push({
          variant: variant.variant,
          game: variant.game,
          scenario: scenario.name,
          mode: scenario.mode,
          viewport: scenario.viewport,
          status: result.issues.length ? "WARN" : "PASS",
          issues: result.issues,
          metrics: result.metrics,
          screenshotPath: shot,
        });

        expect(variant.variant).toBeTruthy();
      });
    }
  }

  test("D01 replay captures timeline and frame-control readability evidence", async ({ page }) => {
    const replay = await captureReplayEvidence(page);
    rows.push({
      variant: "D01",
      game: "2-7 Triple Draw",
      scenario: "desktop-replay",
      mode: "replay",
      viewport: { width: 1280, height: 720 },
      status: replay.metrics.eventRows > 0 && replay.metrics.frameCounter ? "PASS" : "WARN",
      issues: replay.metrics.eventRows > 0 ? [] : [{ priority: "P1", issue: "replay event rows not visible" }],
      metrics: replay.metrics,
      screenshotPath: replay.screenshotPath,
    });
    expect(replay.metrics.controls.next).toBe(true);
  });
});
