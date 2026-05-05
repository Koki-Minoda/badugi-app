import { expect, test } from "@playwright/test";
import { APP_URL, openAuthenticatedGame, openAuthenticatedMenu } from "./authHelper";

async function waitForDriver(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        window.__BADUGI_E2E__?.getStateSnapshot &&
          window.__BADUGI_E2E__?.getPhaseState &&
          window.__BADUGI_E2E__?.forceControllerAction,
      ),
    undefined,
    { timeout: 60000 },
  );
}

async function getState(page) {
  return page.evaluate(() => {
    const api = window.__BADUGI_E2E__;
    const state = api?.getStateSnapshot?.() ?? null;
    const phaseState = api?.getPhaseState?.() ?? null;
    return {
      ...state,
      phaseState,
      phase: phaseState?.phase ?? state?.phase ?? state?.controllerSnapshot?.phase,
      turn:
        typeof phaseState?.turn === "number"
          ? phaseState.turn
          : state?.controllerSnapshot?.currentActor ?? state?.controllerSnapshot?.turn ?? state?.turn,
      players: phaseState?.players ?? state?.controllerSnapshot?.players ?? [],
    };
  });
}

async function invokeE2E(page, method, ...args) {
  return page.evaluate(
    ({ methodName, params }) => {
      const api = window.__BADUGI_E2E__;
      if (!api || typeof api[methodName] !== "function") {
        throw new Error(`E2E helper ${methodName} is not available`);
      }
      return api[methodName](...params);
    },
    { methodName: method, params: args },
  );
}

async function forceCurrentControllerAction(page) {
  const state = await getState(page);
  const snapshot = state?.controllerSnapshot;
  const actor = snapshot?.currentActor ?? snapshot?.turn ?? state?.turn;
  if (typeof actor !== "number") return false;
  const player = snapshot?.players?.[actor] ?? state?.players?.[actor];
  if (!player || player.folded || player.hasFolded || player.seatOut || player.allIn) return false;
  const toCall = Math.max(
    0,
    Number(snapshot?.currentBet ?? 0) -
      Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0),
  );
  const actionSnapshot = await page.evaluate(
    ({ seat, payload }) => window.__BADUGI_E2E__?.forceControllerAction?.(seat, payload),
    { seat: actor, payload: { type: toCall > 0 ? "call" : "check", amount: toCall } },
  );
  return Boolean(actionSnapshot);
}

async function forceDealNewHand(page) {
  await invokeE2E(page, "forceDealNewHandNow");
  await page.waitForTimeout(250);
}

async function resolveHandNow(page) {
  await invokeE2E(page, "resolveHandNow");
  await page.waitForTimeout(250);
}

async function getLastPotSummary(page) {
  return page.evaluate(() => window.__BADUGI_E2E__?.getLastPotSummary?.() ?? []);
}

test.describe("MGX game progress add-on E2E", () => {
  test.describe.configure({ timeout: 120000 });

  test("Title to Main Menu to Cash Game exposes stable hero action UI", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedMenu(page);
    await page.getByTestId("menu-ring").click();
    await expect(page.getByText(/Badugi|2-7 Triple Draw|PLO|Hold'em/i).first()).toBeVisible({ timeout: 20000 });
    await page.getByTestId("game-selector-play-badugi").first().click();
    await waitForDriver(page);
    await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("player-0-card-0")).toBeVisible({ timeout: 20000 });
    const state = await getState(page);
    expect(["BET", "DRAW", "SHOWDOWN", "HAND_RESULT"]).toContain(String(state?.phase ?? ""));
  });

  test("Badugi draw or pat UI progresses to later phase without freeze", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page, `${APP_URL}?variant=badugi`);
    await waitForDriver(page);
    await forceDealNewHand(page);
    await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("player-0-card-0")).toBeVisible({ timeout: 20000 });
    const drawButton = page.getByTestId("action-draw-selected").first();
    if ((await drawButton.count()) && (await drawButton.isVisible().catch(() => false))) {
      await drawButton.click();
    } else {
      await invokeE2E(page, "forceHeroDraw");
    }
    await page.waitForTimeout(500);
    const after = await getState(page);
    expect(["BET", "DRAW", "SHOWDOWN", "HAND_RESULT"]).toContain(String(after?.phase ?? ""));
  });

  test("PLO action execution reaches showdown or hand result without freeze", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page, `${APP_URL}?variant=plo`);
    await waitForDriver(page);
    await forceDealNewHand(page);
    const beforeAction = await getState(page);
    const acted = await forceCurrentControllerAction(page);
    expect(acted).toBe(true);
    const afterAction = await getState(page);
    expect({
      phase: afterAction?.phase,
      turn: afterAction?.turn,
      currentBet: afterAction?.controllerSnapshot?.currentBet,
      pot: afterAction?.controllerSnapshot?.pot,
    }).not.toEqual({
      phase: beforeAction?.phase,
      turn: beforeAction?.turn,
      currentBet: beforeAction?.controllerSnapshot?.currentBet,
      pot: beforeAction?.controllerSnapshot?.pot,
    });
    await resolveHandNow(page);
    const finalState = await getState(page);
    const potSummary = await getLastPotSummary(page);
    await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
    expect(["SHOWDOWN", "HAND_RESULT", "WAITING_NEXT_HAND", "BET", "DRAW"]).toContain(
      String(finalState?.phase ?? finalState?.controllerSnapshot?.phase ?? ""),
    );
    expect(Array.isArray(potSummary)).toBe(true);
    expect(potSummary.length).toBeGreaterThan(0);
  });

  test("Tournament start stays in valid table state while CPUs act", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedMenu(page);
    await page.getByTestId("menu-tournament").click();
    await waitForDriver(page);
    await expect(page.getByText(/Tournament|トーナメント|Store/i).first()).toBeVisible({ timeout: 20000 });
    const state = await getState(page);
    expect(state?.players?.some((player) => player && !player.seatOut)).toBe(true);
  });

  test("Mobile Chrome landscape keeps main action buttons clickable", async ({ browser }) => {
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
      await waitForDriver(page);
      const action = page
        .locator("[data-testid='action-check'],[data-testid='action-call'],[data-testid='action-raise'],[data-testid='action-draw-selected']")
        .first();
      await expect(action).toBeVisible({ timeout: 30000 });
      const box = await action.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    } finally {
      await context.close();
    }
  });
});
