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

async function installLocalAuthenticatedSession(page: Page, stageId: string) {
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
  await page.addInitScript(({ selectedStageId }) => {
    let randomState = selectedStageId === "local" ? 0x10ca1 : 0x570ae;
    Math.random = () => {
      randomState = (randomState + 0x6d2b79f5) | 0;
      let value = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
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
    const requirements = {
      store: { bankroll: 0, stageWins: { store: 0, local: 0, national: 0, world: 0 } },
      local: { bankroll: 1_000, stageWins: { store: 1, local: 0, national: 0, world: 0 } },
      national: { bankroll: 3_000, stageWins: { store: 0, local: 1, national: 0, world: 0 } },
      world: { bankroll: 7_500, stageWins: { store: 0, local: 0, national: 2, world: 0 } },
    }[selectedStageId];
    window.localStorage.setItem(
      "mgx.tournament.v2",
      JSON.stringify({
        version: 2,
        tournament: {
          ...requirements,
          completedTournaments: [],
          lastResult: null,
          history: [],
        },
        career: {
          unlockedVariants: ["badugi"],
          achievements: [],
          statistics: {
            tournamentsPlayed: 0,
            tournamentsWon: 0,
            finalTables: 0,
            headsUps: 0,
            totalPrize: 0,
          },
          worldChampionship: {
            cleared: false,
            firstClearTimestamp: null,
            clearCount: 0,
            lastUnlockPopupAt: null,
          },
        },
        rivals: {},
        _meta: { migratedFrom: [], migratedAt: null, legacyKeysRetained: true },
      }),
    );
  }, { selectedStageId: stageId });
}

async function startProductionStage(page: Page, stageId: string) {
  const config = buildTournamentConfigFromStage(stageId);
  if (!config) throw new Error(`Missing tournament config for ${stageId}`);

  await installLocalAuthenticatedSession(page, stageId);
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

async function completeHeroHands(page: Page, hands: number, policy = "safe") {
  for (let hand = 0; hand < hands; hand += 1) {
    const result = await playOneHandProgression(page, {
      maxSteps: 110,
      policy,
      requireHeroButtonClick: false,
    });
    expect(result.status).toBe("PASS");
    const nextHand = page.getByRole("button", { name: /Next Hand|次のハンド/i });
    await expect(nextHand).toBeVisible({ timeout: 10_000 });
    await nextHand.click({ timeout: 5_000 }).catch(async (error) => {
      // A successful click immediately replaces the result controls. On long
      // soaks Chromium can report that replacement as a detached locator even
      // though the next hand is already live; only tolerate that exact state.
      const phase = await page.evaluate(
        () => window.__BADUGI_E2E__?.getStateSnapshot?.()?.phase,
      );
      if (["SHOWDOWN", "HAND_RESULT", "WAITING_NEXT_HAND"].includes(
        String(phase ?? "").toUpperCase(),
      )) {
        throw error;
      }
    });
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

async function advanceFromCompletedHand(page: Page) {
  const breakOverlay = page.getByTestId("tournament-break-overlay");
  if (await breakOverlay.isVisible().catch(() => false)) {
    await page
      .getByRole("button", { name: "休憩を終了して続ける" })
      .click();
    await expect(breakOverlay).toBeHidden();
  }
  const nextHand = page.getByRole("button", { name: /Next Hand|次のハンド/i });
  await expect(nextHand).toBeVisible({ timeout: 10_000 });
  await nextHand.click({ timeout: 5_000 }).catch(async (error) => {
    const phase = await page.evaluate(
      () => window.__BADUGI_E2E__?.getStateSnapshot?.()?.phase,
    );
    if (["SHOWDOWN", "HAND_RESULT", "WAITING_NEXT_HAND"].includes(
      String(phase ?? "").toUpperCase(),
    )) {
      throw error;
    }
  });
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

async function completeProductionTournament(page: Page, stageId: string) {
  const config = await startProductionStage(page, stageId);
  const levelsVisited = new Set<number>();
  const remainingTrace: number[] = [];
  let realHeroHands = 0;
  let backgroundCyclesAfterHeroBust = 0;

  for (let step = 0; step < 500; step += 1) {
    const hud = await getHud(page);
    expect(hud).toBeTruthy();
    levelsVisited.add(hud.currentLevelNumber);
    remainingTrace.push(hud.playersRemaining);
    expect(hud.playersRemaining).toBeGreaterThan(0);
    expect(hud.playersRemaining).toBeLessThanOrEqual(config.totalPlayers);
    expect(hud.tablesActive).toBeGreaterThan(0);
    expect(hud.tablesActive).toBeLessThanOrEqual(
      Math.ceil(hud.playersRemaining / config.seatsPerTable),
    );

    const expectedLevel = config.levels.find(
      (level) => level.levelIndex === hud.currentLevelNumber,
    );
    expect(expectedLevel).toBeTruthy();
    expect(hud.currentBlinds).toEqual({
      sb: expectedLevel.smallBlind,
      bb: expectedLevel.bigBlind,
      ante: expectedLevel.ante,
    });

    if (hud.isFinished) {
      expect(hud.championId).toBeTruthy();
      expect(hud.playersRemaining).toBe(1);
      expect(hud.finishOrderCount).toBe(config.totalPlayers - 1);
      for (let index = 1; index < remainingTrace.length; index += 1) {
        expect(remainingTrace[index]).toBeLessThanOrEqual(
          remainingTrace[index - 1],
        );
      }
      expect(hud.levelEvents).toEqual(
        Array.from(
          { length: Math.max(0, hud.currentLevelNumber - 1) },
          (_, index) =>
            expect.objectContaining({
              fromLevel: index + 1,
              toLevel: index + 2,
            }),
        ),
      );
      expect(hud.milestoneEvents).toEqual(
        expect.arrayContaining(["FINAL_TABLE", "TOP_THREE", "HEADS_UP"]),
      );
      await expect
        .poll(() =>
          page.evaluate(() => ({
            resultVisible: Boolean(
              document.querySelector('[data-testid="mtt-result-overlay"]') ||
                document.querySelector(
                  '[data-testid="mtt-hero-bust-overlay"]',
                ),
            ),
            placements: window.__BADUGI_E2E__.getTournamentPlacements(),
            review: window.__BADUGI_E2E__.getTournamentReview(),
          })),
        )
        .toMatchObject({
          resultVisible: true,
          placements: expect.arrayContaining([
            expect.objectContaining({ place: 1, id: hud.championId }),
          ]),
          review: expect.objectContaining({
            placement: hud.heroFinishPlace,
            totalHands: expect.any(Number),
          }),
        });
      const review = await page.evaluate(() =>
        window.__BADUGI_E2E__.getTournamentReview(),
      );
      await expect(page.getByTestId("mtt-tournament-review")).toBeVisible();
      expect(review.totalHands).toBeGreaterThan(0);
      expect(review.heroActions.length).toBeGreaterThan(0);
      expect(review.reviewSummary.facts.length).toBeGreaterThan(0);
      expect(review.reviewSummary.nextActions.length).toBeGreaterThan(0);
      const handIds = new Set(review.hands.map((hand) => hand.handId));
      const actionKeys = new Set(
        review.heroActions.map(
          (action) => `${action.handId}:${action.actionSeq}`,
        ),
      );
      review.keyHands.forEach((keyHand) => {
        expect(handIds.has(keyHand.handId)).toBe(true);
        keyHand.evidence.forEach((evidence) => {
          expect(handIds.has(evidence.handId)).toBe(true);
          if (Number.isFinite(evidence.actionSeq)) {
            expect(
              actionKeys.has(`${evidence.handId}:${evidence.actionSeq}`),
            ).toBe(true);
          }
        });
      });
      return {
        config,
        hud,
        realHeroHands,
        backgroundCyclesAfterHeroBust,
        levelsVisited: [...levelsVisited],
        review,
      };
    }

    expect(
      await page
        .getByRole("button", { name: "Enter New Tournament" })
        .count(),
    ).toBe(0);

    const finishBreakButton = page.getByRole("button", {
      name: "休憩を終了して続ける",
    });
    if (await finishBreakButton.isVisible().catch(() => false)) {
      await finishBreakButton.click();
      await expect(page.getByTestId("tournament-break-overlay")).toBeHidden();
    }

    if (hud.heroBusted) {
      await page.evaluate(() =>
        window.__BADUGI_E2E__.simulateTournamentBackground(1),
      );
      backgroundCyclesAfterHeroBust += 1;
      continue;
    }

    const result = await playOneHandProgression(page, {
      maxSteps: 110,
      policy: "safe",
      requireHeroButtonClick: false,
    });
    expect(result.status).toBe("PASS");
    realHeroHands += 1;

    const afterHand = await getHud(page);
    if (!afterHand.isFinished && !afterHand.heroBusted) {
      await advanceFromCompletedHand(page);
    }
  }

  throw new Error(`Tournament did not finish: ${stageId}`);
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

test("scheduled tournament break blocks the next hand, counts down, and resumes", async ({ page }) => {
  const baseConfig = await startProductionStage(page, "store");
  await page.evaluate((config) => {
    window.__BADUGI_E2E__.startTournamentMTT({
      ...config,
      totalPlayers: 6,
      tables: 1,
      breakEveryLevels: 1,
      breakDurationMinutes: 1,
      levels: config.levels.slice(0, 2).map((level) => ({
        ...level,
        hands: 1,
        handsThisLevel: 1,
      })),
    });
  }, baseConfig);

  const result = await playOneHandProgression(page, {
    maxSteps: 110,
    policy: "safe",
    requireHeroButtonClick: false,
  });
  expect(result.status).toBe("PASS");
  await expect(page.getByTestId("tournament-break-overlay")).toBeVisible();
  await expect(page.getByTestId("tournament-break-clock")).toContainText(/00:5\d|01:00/);

  await page.getByRole("button", { name: "休憩を終了して続ける" }).click();
  await expect(page.getByTestId("tournament-break-overlay")).toBeHidden();
  await page.getByRole("button", { name: /Next Hand|次のハンド/i }).click();
  await expect.poll(async () => (await getHud(page))?.currentLevelNumber).toBe(2);
});

test("Store runs from its production field to a verified champion", async ({ page }) => {
  const completed = await completeProductionTournament(page, "store");
  expect(completed.realHeroHands).toBeGreaterThan(0);
  expect(completed.levelsVisited.length).toBeGreaterThan(1);
  console.info("[MTT_COMPLETION]", JSON.stringify({
    stageId: "store",
    realHeroHands: completed.realHeroHands,
    backgroundHands: completed.hud.abstractHandCounter,
    finalLevel: completed.hud.currentLevelNumber,
    heroPlace: completed.hud.heroFinishPlace,
    championId: completed.hud.championId,
  }));
});

test("Local runs from its production field through ante levels to a verified champion", async ({
  page,
}) => {
  const completed = await completeProductionTournament(page, "local");
  expect(completed.realHeroHands).toBeGreaterThan(0);
  expect(completed.hud.currentLevelNumber).toBeGreaterThanOrEqual(4);
  console.info("[MTT_COMPLETION]", JSON.stringify({
    stageId: "local",
    realHeroHands: completed.realHeroHands,
    backgroundHands: completed.hud.abstractHandCounter,
    finalLevel: completed.hud.currentLevelNumber,
    heroPlace: completed.hud.heroFinishPlace,
    championId: completed.hud.championId,
  }));
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

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const saved = JSON.parse(
            window.localStorage.getItem("mgx.tournament.v2") ?? "{}",
          );
          return saved?.tournament?.bankroll ?? null;
        }),
      )
      .toBe(stage.payout);

    await page
      .getByRole("button", { name: "Enter New Tournament" })
      .click();
    await expect(page.getByTestId("tournament-hud")).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const saved = JSON.parse(
            window.localStorage.getItem("mgx.tournament.v2") ?? "{}",
          );
          return saved?.tournament?.bankroll ?? null;
        }),
      )
      .toBe(stage.payout - stage.entryFee);
  });
}
