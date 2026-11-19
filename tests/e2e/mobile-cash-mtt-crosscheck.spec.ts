import { test, expect, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  APP_URL,
  openAuthenticatedGame,
  deleteAuthenticatedSession,
  selectGameVariantFromSelector,
  enterTitleIfPresent,
} from "./authHelper";
import {
  waitForE2EDriver,
  playOneHandProgression,
  getProgressState,
  performSafeAction,
} from "./helpers/gameProgressHelper.js";
import { normalizeAppVariantId } from "../../src/ui/game/appVariantRouting.js";
import { classifyCrossVariantStateLeak } from "../../src/ui/qa/assertNoCrossVariantStateLeak.js";
const BADEUCEY = "badeucey_triple_draw";
const ACTIVE = "mgx.tournament.mtt.active";
function mark(info: TestInfo, stage: string, data: unknown = null) {
  const file = info.outputPath("steps.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(
    file,
    JSON.stringify({ at: new Date().toISOString(), stage, data }) + "\n",
  );
}
async function saved(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
    ACTIVE,
  );
}
async function checkTable(
  page: Page,
  variant: string,
  mode: string,
  info: TestInfo,
) {
  await waitForE2EDriver(page);
  await expect(page.getByTestId("decision-panel")).toBeVisible({
    timeout: 20000,
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.__BADUGI_E2E__.getStateSnapshot().gameVariant),
    )
    .toBe(variant);
  const audit = await page.evaluate(() =>
    window.__BADUGI_E2E__.getCrossVariantStateAudit(),
  );
  expect(audit.mode).toBe(mode);
  const normalizedAudit = { ...audit };
  for (const key of [
    "currentVariant",
    "controllerVariantRef",
    "gameControllerVariantId",
    "sessionVariantId",
    "controllerSnapshotVariantId",
    "engineStateVariantId",
  ]) {
    normalizedAudit[key] = normalizeAppVariantId(audit[key], null);
  }
  const leakAudit = classifyCrossVariantStateLeak(normalizedAudit);
  mark(info, "table-audit", { ...normalizedAudit, leakAudit });
  expect(leakAudit.violations).toEqual([]);
}
async function playHand(page: Page, info: TestInfo) {
  mark(info, "hand-start");
  const result = await playOneHandProgression(page, {
    maxSteps: 180,
    autoCpu: true,
    requireHeroButtonClick: true,
    onStep: ({ step, progress }) =>
      mark(info, "action", {
        step,
        phase: progress.phase,
        actor: progress.actor,
        handId: progress.handId,
      }),
  });
  expect(result.status).toBe("PASS");
  mark(info, "hand-complete", result);
}
async function cashToMenu(page: Page) {
  await page.getByTestId("hand-result-cash-out").click();
  await page
    .getByRole("dialog", { name: "Cash out result" })
    .getByRole("button", { name: "ゲーム選択", exact: true })
    .click();
  await expect(page.getByTestId("menu-ring")).toBeVisible();
}
async function pause(page: Page) {
  if (await page.getByTestId("hand-result-overlay").isVisible()) {
    await page.getByTestId("hand-result-next-hand").click();
    await expect(page.getByTestId("hand-result-overlay")).toBeHidden();
  }
  await page.getByLabel("対局メニュー", { exact: true }).click();
  await page.getByRole("button", { name: "大会を中断", exact: true }).click();
  await expect(page.getByTestId("menu-ring")).toBeVisible();
}
async function startFixture(page: Page, variant: string, info: TestInfo) {
  mark(info, "fixture-tournament-start", variant);
  await page.evaluate(
    (gameVariant) =>
      window.__BADUGI_E2E__.startTournamentMTT({
        id: "mobile-crosscheck",
        name: "Mobile crosscheck",
        practiceOnly: true,
        tables: 2,
        seatsPerTable: 6,
        totalPlayers: 12,
        startingStack: 2000,
        gameVariant,
        gameRotation: [gameVariant],
        rotationPolicy: "fixed",
        levels: [
          {
            levelIndex: 1,
            smallBlind: 5,
            bigBlind: 10,
            ante: 0,
            handsThisLevel: 999,
          },
        ],
        payouts: [{ place: 1, percent: 100 }],
      }),
    variant,
  );
  await expect(page.getByTestId("tournament-hud")).toBeVisible({
    timeout: 20000,
  });
  await checkTable(page, variant, "tournament-mtt", info);
}
async function resume(page: Page, variant: string, info: TestInfo) {
  await page.getByTestId("menu-tournament").click();
  await expect(page.getByTestId("tournament-resume-panel")).toBeVisible();
  await page.getByTestId("tournament-resume").click();
  await expect(page.getByTestId("tournament-hud")).toBeVisible({
    timeout: 20000,
  });
  const next = page.getByRole("button", { name: /次のハンド|Next Hand/i });
  await expect(next).toBeVisible();
  await next.click();
  await checkTable(page, variant, "tournament-mtt", info);
}

test.beforeEach(async ({ page }, info) => {
  mark(info, "browser-ready");
  await page.addInitScript(() =>
    localStorage.setItem("mgx.handResult.autoNext", "off"),
  );
  page.on("pageerror", (error) => mark(info, "page-error", error.message));
});

test("Cash Badeucey to Badugi MTT through the tournament hub", async ({
  page,
}, info) => {
  const session = await openAuthenticatedGame(
    page,
    `${APP_URL}?variant=${BADEUCEY}&mode=cash`,
  );
  try {
    await checkTable(page, BADEUCEY, "cash", info);
    await playHand(page, info);
    await cashToMenu(page);
    await page.getByTestId("menu-tournament").click();
    await page.getByTestId("tournament-stage-store").click();
    await page.getByTestId("tournament-start").click();
    await checkTable(page, "badugi", "tournament-mtt", info);
    await playHand(page, info);
  } finally {
    await deleteAuthenticatedSession(page, session);
  }
});

for (const scenario of ["boundary", "bet", "draw", "reload", "reverse"]) {
  test(`MTT to Cash and resume across variants: ${scenario}`, async ({
    page,
  }, info) => {
    const tournamentVariant = scenario === "reverse" ? "badugi" : BADEUCEY;
    const cashVariant = scenario === "reverse" ? BADEUCEY : "badugi";
    const session = await openAuthenticatedGame(
      page,
      `${APP_URL}?variant=${tournamentVariant}&mode=cash`,
    );
    try {
      await waitForE2EDriver(page);
      await startFixture(page, tournamentVariant, info);
      if (["boundary", "reload", "reverse"].includes(scenario))
        await playHand(page, info);
      if (scenario === "draw") {
        for (let i = 0; i < 60; i++) {
          const progress = await getProgressState(page);
          if (progress.phase === "DRAW") break;
          expect(progress.isTerminal).toBe(false);
          await performSafeAction(page, { autoCpu: true });
        }
        expect((await getProgressState(page)).phase).toBe("DRAW");
      }
      await pause(page);
      const before = await saved(page);
      expect(before).toBeTruthy();
      mark(info, "paused", before);
      await page.getByTestId("menu-ring").click();
      await selectGameVariantFromSelector(page, cashVariant);
      await checkTable(page, cashVariant, "cash", info);
      await playHand(page, info);
      const afterCash = await saved(page);
      mark(info, "saved-after-cash", afterCash);
      expect(afterCash.tournamentState).toEqual(before.tournamentState);
      await cashToMenu(page);
      if (scenario === "reload") {
        await page.reload();
        await enterTitleIfPresent(page);
      }
      await resume(page, tournamentVariant, info);
      await playHand(page, info);
      const resumed = await saved(page);
      expect(resumed.tournamentState.tournamentRunId).toBe(
        before.tournamentState.tournamentRunId,
      );
      mark(info, "resumed", resumed);
    } finally {
      await deleteAuthenticatedSession(page, session);
    }
  });
}
