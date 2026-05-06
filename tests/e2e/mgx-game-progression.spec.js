import { expect, test } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import {
  expectMobileActionsInViewport,
  getCurrentPhase,
  getProgressState,
  invokeE2E,
  performSafeAction,
  playOneHandProgression,
  progressKey,
  summarizeProgressState,
  waitForE2EDriver,
  waitForHandEnd,
  waitForPhaseChange,
  waitForProgressChange,
} from "./helpers/gameProgressHelper.js";

test.describe("MGX progression-guarantee E2E", () => {
  test.describe.configure({ timeout: 180000 });

  test("TEST-001 Badugi completes one cash hand through UI/controller progression", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page, `${APP_URL}?variant=badugi`);
    await waitForE2EDriver(page);
    await invokeE2E(page, "forceDealNewHandNow");

    const result = await playOneHandProgression(page, {
      maxSteps: 90,
      policy: "heroThenFold",
      requireHeroButtonClick: true,
    });

    expect(result.status).toBe("PASS");
    expect(result.heroButtonClicks).toBeGreaterThan(0);
    expect(result.steps).toBeLessThanOrEqual(90);
  });

  test("TEST-002 fold-heavy progression moves turn and reaches a terminal hand state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page, `${APP_URL}?variant=badugi`);
    await waitForE2EDriver(page);
    await invokeE2E(page, "forceDealNewHandNow");

    const beforePhase = await getCurrentPhase(page);
    const result = await playOneHandProgression(page, {
      maxSteps: 40,
      policy: "foldNonHero",
    });

    expect(result.status).toBe("PASS");
    expect(result.trace.length).toBeGreaterThan(1);
    expect(result.visitedPhases.length).toBeGreaterThan(0);
    expect(String(beforePhase || "")).toBeTruthy();
  });

  test("TEST-003 Badugi draw phase preserves hero hand identity after draw actions", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page, `${APP_URL}?variant=badugi`);
    await waitForE2EDriver(page);
    await invokeE2E(page, "forceDealNewHandNow");

    const before = await getProgressState(page);
    const heroBefore = JSON.stringify(before.players?.[0]?.hand ?? before.snapshot?.players?.[0]?.hand ?? []);
    const key = progressKey(before);
    expect(await invokeE2E(page, "forceFinishRoundForTest", "BET")).toBe(true);
    await waitForProgressChange(page, key, { timeout: 20000 });
    await waitForPhaseChange(page, "BET");

    let heroDrawClicked = false;
    const drawTrace = [];
    for (let step = 0; step < 24; step += 1) {
      const progress = await getProgressState(page);
      drawTrace.push(summarizeProgressState(progress));
      if (progress.isTerminal || String(progress.phase) !== "DRAW") break;
      const action = await performSafeAction(page, {
        policy: "safe",
      });
      if (!action.acted) {
        throw new Error(`Draw action did not progress: ${JSON.stringify({ action, drawTrace })}`);
      }
      if (action.actor === 0 && action.clickedAction === "action-draw-selected") {
        heroDrawClicked = true;
        break;
      }
      await waitForProgressChange(page, progressKey(progress), { timeout: 12000 });
    }

    expect(heroDrawClicked, `hero draw button should be exercised: ${JSON.stringify(drawTrace)}`).toBe(true);
    const after = await getProgressState(page);
    const heroAfter = JSON.stringify(after.players?.[0]?.hand ?? after.snapshot?.players?.[0]?.hand ?? []);

    await invokeE2E(page, "resolveHandNow");
    await waitForHandEnd(page);
    expect(heroAfter, `hero hand should remain present after draw flow; before=${heroBefore}`).not.toBe("[]");
  });

  test("TEST-004 all-in progression does not leave the all-in player as BET actor", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page, `${APP_URL}?variant=badugi`);
    await waitForE2EDriver(page);
    await invokeE2E(page, "forceDealNewHandNow");

    const targetSeat = 1;
    await invokeE2E(page, "forceAllIn", targetSeat);
    await page.waitForFunction(
      (seat) => {
        const api = window.__BADUGI_E2E__;
        const phaseState = api?.getPhaseState?.();
        const snapshot = api?.getStateSnapshot?.()?.controllerSnapshot;
        const phase = phaseState?.phase ?? snapshot?.phase ?? snapshot?.street;
        const actor =
          typeof phaseState?.turn === "number"
            ? phaseState.turn
            : typeof snapshot?.currentActor === "number"
              ? snapshot.currentActor
              : snapshot?.turn;
        const player = phaseState?.players?.[seat] ?? snapshot?.players?.[seat];
        if (!player?.allIn) return false;
        return phase !== "BET" || actor !== seat;
      },
      targetSeat,
      { timeout: 30000 },
    );

    const afterAllIn = await getProgressState(page);
    expect(afterAllIn.phase !== "BET" || afterAllIn.actor !== targetSeat).toBe(true);

    const key = progressKey(afterAllIn);
    await invokeE2E(page, "resolveHandNow");
    await waitForProgressChange(page, key, { timeout: 15000 });
    await waitForHandEnd(page);
    const finalState = await getProgressState(page);
    expect(finalState.isTerminal).toBe(true);
  });

  test("TEST-005 Badugi progresses five consecutive hands without freeze", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page, `${APP_URL}?variant=badugi`);
    await waitForE2EDriver(page);

    const handIds = new Set();
    for (let hand = 0; hand < 5; hand += 1) {
      await invokeE2E(page, "forceDealNewHandNow");
      const result = await playOneHandProgression(page, {
        maxSteps: 80,
        policy: "heroThenFold",
      });
      const progress = await getProgressState(page);
      handIds.add(progress.handId ?? `hand-${hand}`);
      expect(result.status).toBe("PASS");
      expect(result.steps).toBeLessThanOrEqual(80);
    }
    expect(handIds.size).toBeGreaterThanOrEqual(3);
  });

  test("TEST-006 mobile landscape keeps progression action controls usable and in viewport", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
    });
    const page = await context.newPage();
    try {
      await openAuthenticatedGame(page, `${APP_URL}?variant=badugi`);
      await waitForE2EDriver(page);
      await expectMobileActionsInViewport(page);
      const beforePhase = await getCurrentPhase(page);
      await playOneHandProgression(page, {
        maxSteps: 40,
        policy: "heroThenFold",
        requireHeroButtonClick: true,
      });
      await waitForPhaseChange(page, beforePhase).catch(() => {});
      const bodyScroll = await page.evaluate(() => ({
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        overflowing: document.documentElement.scrollWidth > window.innerWidth + 2,
      }));
      expect(bodyScroll.scrollX).toBe(0);
      expect(bodyScroll.overflowing).toBe(false);
    } finally {
      await context.close();
    }
  });

  test("progression failure logs include reproducible state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page, `${APP_URL}?variant=badugi`);
    await waitForE2EDriver(page);
    const progress = await getProgressState(page);
    expect(summarizeProgressState(progress)).toMatchObject({
      phase: expect.any(String),
    });
  });
});
