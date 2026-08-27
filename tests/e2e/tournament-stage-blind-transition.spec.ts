import { expect, test, type Page } from "@playwright/test";
import { buildTournamentConfigFromStage } from "../../src/config/tournamentStages.js";
import { APP_URL } from "./authHelper";
import {
  playOneHandProgression,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

const TOURNAMENT_URL = `${APP_URL.replace(/\/$/, "")}/dev/tournament`;

type BlindExpectation = {
  level: number;
  sb: number;
  bb: number;
  ante: number;
};

async function installLocalAuthenticatedSession(page: Page) {
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname.endsWith("/auth/me")
      ? {
          id: 7003,
          username: "Stage Gate Hero",
          email: "stage.gate.hero@mgx-e2e.test",
        }
      : {};
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "mgx_auth",
      JSON.stringify({
        accessToken: "local-tournament-stage-gate-token",
        tokenType: "Bearer",
        user: {
          id: 7003,
          username: "Stage Gate Hero",
          email: "stage.gate.hero@mgx-e2e.test",
        },
        isAuthenticated: true,
      }),
    );
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
}

async function startProductionStage(page: Page, stageId: string) {
  const config = buildTournamentConfigFromStage(stageId);
  if (!config) throw new Error(`Missing tournament config for ${stageId}`);

  await installLocalAuthenticatedSession(page);
  await page.goto(TOURNAMENT_URL, { waitUntil: "load" });
  await page.getByTestId(`tournament-stage-${stageId}`).click();
  await expect(page.getByTestId("tournament-stage-detail")).toContainText(config.name);
  await page.getByTestId("tournament-start").click();
  await expect(page.getByTestId("tournament-hud")).toBeVisible({ timeout: 20_000 });
  await waitForE2EDriver(page);
  return config;
}

async function getHud(page: Page) {
  return page.evaluate(() => window.__BADUGI_E2E__.getTournamentHudState());
}

async function expectCurrentBlindDisplay(page: Page, expected: BlindExpectation) {
  await expect
    .poll(async () => {
      const hud = await getHud(page);
      return {
        level: hud?.currentLevelNumber,
        sb: hud?.currentBlinds?.sb,
        bb: hud?.currentBlinds?.bb,
        ante: hud?.currentBlinds?.ante,
      };
    })
    .toEqual(expected);

  const hud = page.getByTestId("tournament-hud");
  await expect(hud.getByText(`Level ${expected.level}`, { exact: false }).first()).toBeVisible();
  await expect(hud.getByText(`${expected.sb} / ${expected.bb}`, { exact: true }).first()).toBeVisible();
}

async function completeHeroHands(page: Page, hands: number) {
  for (let hand = 0; hand < hands; hand += 1) {
    const result = await playOneHandProgression(page, {
      maxSteps: 110,
      policy: "safe",
      requireHeroButtonClick: false,
    });
    expect(result.status).toBe("PASS");
    const nextHand = page.getByRole("button", { name: /Next Hand|次のハンド/i });
    await expect(nextHand).toBeVisible({ timeout: 10_000 });
    await nextHand.click();
    await page.waitForFunction(
      () => {
        const phase = window.__BADUGI_E2E__?.getStateSnapshot?.()?.phase;
        return !["SHOWDOWN", "HAND_RESULT", "WAITING_NEXT_HAND"].includes(
          String(phase ?? "").toUpperCase(),
        );
      },
      undefined,
      { timeout: 10_000 },
    );
  }
}

test.describe.configure({ timeout: 180_000 });

for (const stage of [
  {
    stageId: "store",
    initial: { level: 1, sb: 5, bb: 10, ante: 0 },
    next: { level: 2, sb: 10, bb: 20, ante: 1 },
  },
  {
    stageId: "local",
    initial: { level: 1, sb: 25, bb: 50, ante: 0 },
    next: { level: 2, sb: 50, bb: 100, ante: 0 },
  },
]) {
  test(`${stage.stageId} updates the visible HUD only after its fifth completed hand`, async ({ page }) => {
    const config = await startProductionStage(page, stage.stageId);
    expect(config.levels[0].handsThisLevel).toBe(5);
    await expectCurrentBlindDisplay(page, stage.initial);

    await completeHeroHands(page, 4);
    await expectCurrentBlindDisplay(page, stage.initial);
    await expect.poll(async () => (await getHud(page))?.handsPlayedThisLevel).toBe(4);

    await completeHeroHands(page, 1);
    await expectCurrentBlindDisplay(page, stage.next);
    await expect.poll(async () => (await getHud(page))?.handsPlayedThisLevel).toBe(1);
  });
}

test("World Championship starts at production scale, advances a level, and reaches a champion", async ({ page }) => {
  const config = await startProductionStage(page, "world");
  expect(config).toMatchObject({ totalPlayers: 275, tables: 46 });
  expect(config.levels).toHaveLength(20);
  await expectCurrentBlindDisplay(page, { level: 1, sb: 75, bb: 150, ante: 0 });

  await completeHeroHands(page, 5);
  await expectCurrentBlindDisplay(page, { level: 2, sb: 100, bb: 200, ante: 0 });

  const completed = await page.evaluate(async () => {
    return window.__BADUGI_E2E__.fastForwardMTTComplete({ suppressResultOverlay: true });
  });
  expect(completed).toMatchObject({
    isFinished: true,
    playersRemaining: 1,
  });
  expect(completed.championId).toBeTruthy();
  expect(completed.finishOrder).toHaveLength(config.totalPlayers - 1);
});

for (const stage of [
  { stageId: "store", entryFee: 0, payout: 1_000, netResult: 1_000 },
  { stageId: "local", entryFee: 1_000, payout: 12_000, netResult: 11_000 },
]) {
  test(`${stage.stageId} reaches a Hero championship and produces a grounded tournament review`, async ({
    page,
  }) => {
    const config = await startProductionStage(page, stage.stageId);
    expect(config.entryFee).toBe(stage.entryFee);

    // Build genuine hand/action history before deterministically closing the
    // remaining field. Review assertions below must stay grounded in these hands.
    await completeHeroHands(page, 3);
    const completed = await page.evaluate(() =>
      window.__BADUGI_E2E__.forceHeroChampion(),
    );

    expect(completed).toMatchObject({
      isFinished: true,
      championId: "hero-player",
      playersRemaining: 1,
    });
    expect(completed.players["hero-player"]).toMatchObject({
      finishPlace: 1,
      payout: stage.payout,
    });
    expect(completed.finishOrder).toHaveLength(config.totalPlayers - 1);

    const overlay = page.getByTestId("mtt-result-overlay");
    await expect(overlay).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("mtt-champion-celebration")).toContainText("1st Place");
    await expect(page.getByTestId("mtt-result-champion")).toContainText(
      "Stage Gate Hero",
    );
    await expect(page.getByTestId("mtt-tournament-review")).toBeVisible();

    await expect
      .poll(async () =>
        page.evaluate(() => window.__BADUGI_E2E__.getTournamentReview()),
      )
      .toMatchObject({
        placement: 1,
        payout: stage.payout,
        bustHand: null,
        result: {
          placement: 1,
          payout: stage.payout,
          buyIn: stage.entryFee,
          netResult: stage.netResult,
          championId: "hero-player",
        },
      });

    // expect.poll assertions do not return the sampled value, so read the
    // settled review once more for cross-reference integrity checks.
    const settledReview = await page.evaluate(() =>
      window.__BADUGI_E2E__.getTournamentReview(),
    );
    expect(settledReview.totalHands).toBeGreaterThanOrEqual(3);
    expect(settledReview.heroActions.length).toBeGreaterThan(0);
    expect(settledReview.reviewDepth).toBe("hand-history");
    expect(settledReview.reviewSummary.facts.length).toBeGreaterThan(0);
    expect(settledReview.reviewSummary.nextActions.length).toBeGreaterThan(0);
    expect(settledReview.dataQuality.limitations).not.toEqual(
      expect.arrayContaining([
        "hand-history-missing",
        "hero-actions-missing",
        "bust-hand-not-identified",
      ]),
    );

    const handIds = new Set(settledReview.hands.map((hand) => hand.handId));
    const actionKeys = new Set(
      settledReview.heroActions.map((action) => `${action.handId}:${action.actionSeq}`),
    );
    settledReview.keyHands.forEach((keyHand) => {
      expect(handIds.has(keyHand.handId)).toBe(true);
      keyHand.evidence.forEach((evidence) => {
        expect(handIds.has(evidence.handId)).toBe(true);
        if (Number.isFinite(evidence.actionSeq)) {
          expect(actionKeys.has(`${evidence.handId}:${evidence.actionSeq}`)).toBe(true);
        }
      });
    });

    const reviewPanel = page.getByTestId("mtt-tournament-review");
    await expect(reviewPanel).toContainText("確認できた事実");
    await expect(reviewPanel).toContainText("解釈");
    await expect(reviewPanel).toContainText("次の一手");
    await expect(reviewPanel).toContainText(String(stage.payout));
  });
}
