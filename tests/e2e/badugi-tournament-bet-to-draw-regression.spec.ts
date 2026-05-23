import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

const REPORT_DIR = path.resolve("reports/badugi");
const SCREENSHOT_DIR = path.resolve("reports/screenshots");
const TRACE_PATH = path.join(REPORT_DIR, "bet-to-draw-transition-trace.jsonl");
const SUMMARY_PATH = path.join(REPORT_DIR, "badugi-tournament-bet-to-draw-summary.json");
const SCREENSHOT_PATH = path.join(SCREENSHOT_DIR, "badugi-tournament-bet-to-draw-regression.png");

function ensureDirs() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function waitForDriver(page: Page) {
  await page.waitForFunction(
    () =>
      typeof window.__BADUGI_E2E__?.startTournamentMTT === "function" &&
      typeof window.__BADUGI_E2E__?.setupBadugiBetToDrawFixtureForTest === "function" &&
      typeof window.__BADUGI_E2E__?.forceBadugiBetToDrawTransitionForTest === "function" &&
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
  await waitForDriver(page);
  await page.evaluate(() => window.__BADUGI_E2E__?.startTournamentMTT?.());
  await page
    .locator('[data-testid="tournament-hud"], [data-testid="mtt-hud"]')
    .waitFor({ state: "visible", timeout: 20000 });
}

async function phaseChrome(page: Page) {
  return page.evaluate(() => {
    const badge = document.querySelector('[data-testid="table-phase-badge"]');
    const strip = document.querySelector('[data-testid="phase-compact-strip"]');
    const root = document.querySelector("[data-phase-tone]");
    return {
      badgeText: badge?.textContent?.trim() ?? "",
      badgeClass: badge?.className ?? "",
      stripText: strip?.textContent?.trim() ?? "",
      stripClass: strip?.className ?? "",
      phaseTone: root?.getAttribute("data-phase-tone") ?? "",
    };
  });
}

test("Badugi tournament closed BET round enters DRAW instead of waiting forever", async ({
  page,
}) => {
  test.setTimeout(120000);
  ensureDirs();
  await openBadugiTournamentQa(page);

  const fixture = await page.evaluate(() =>
    window.__BADUGI_E2E__?.setupBadugiBetToDrawFixtureForTest?.({ finish: true }),
  );
  expect(fixture?.handId).toContain("BADUGI-BET-DRAW-TRANSITION-001-fixture");
  const before = fixture;

  await page.waitForTimeout(2500);

  const after = await page.evaluate(() =>
    window.__MGX_EXPORT_FREEZE_REPORT__?.({
      label: "badugi-bet-to-draw-after",
      mode: "tournament",
    }),
  );
  const chromeAfterTransition = await phaseChrome(page);
  const trace = await page.evaluate(() => window.__MGX_BADUGI_BET_TO_DRAW_TRACE__ ?? []);
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  fs.writeFileSync(TRACE_PATH, trace.map((row: unknown) => JSON.stringify(row)).join("\n") + "\n");
  fs.writeFileSync(
    SUMMARY_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        before,
        after,
        chromeAfterTransition,
        queued: true,
        tracePath: TRACE_PATH,
        screenshotPath: SCREENSHOT_PATH,
      },
      null,
      2,
    )}\n`,
  );

  expect(before?.phase).toBe("BET");
  expect(Number(after?.drawRound)).toBeGreaterThan(2);
  expect(["DRAW", "BET"]).toContain(after?.phase);
  if (after?.phase === "DRAW") {
    expect(chromeAfterTransition.badgeText).toContain("DRAW RUSHER");
    expect(chromeAfterTransition.badgeClass).toContain("red");
    expect(chromeAfterTransition.stripClass).toContain("red");
    expect(chromeAfterTransition.phaseTone).toBe("draw");
  }
  if (after?.phase === "BET") {
    expect(chromeAfterTransition.badgeText).not.toContain("DRAW RUSHER");
    expect(chromeAfterTransition.badgeClass).not.toContain("red");
    expect(chromeAfterTransition.phaseTone).not.toBe("draw");
    expect(after?.currentBet).toBe(0);
    expect(after?.classification).not.toBe("WAITING_WITH_NO_PENDING_ACTORS");
    expect(after?.classification).not.toBe("WAITING_AFTER_ROUND_SHOULD_CLOSE");
  } else {
    expect(after?.waitingForOtherPlayers).toBe(false);
    expect(after?.controller?.actorSeat).not.toBeNull();
  }
});
