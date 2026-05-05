import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

async function waitForE2EDriver(page: Page) {
  await page.waitForFunction(
    () => {
      const api = window.__BADUGI_E2E__;
      return Boolean(
        api &&
          typeof api.forceDealNewHandNow === "function" &&
          typeof api.resolveHandNow === "function" &&
          typeof api.forceAllIn === "function" &&
          typeof api.getPhaseState === "function" &&
          typeof api.getStateSnapshot === "function",
      );
    },
    undefined,
    { timeout: 60000 },
  );
}

async function invokeE2E(page: Page, method: string, ...args: unknown[]) {
  return page.evaluate(
    async ({ methodName, params }) => {
      const api = window.__BADUGI_E2E__;
      if (!api || typeof api[methodName] !== "function") {
        throw new Error(`E2E helper ${methodName} is not available`);
      }
      return await api[methodName](...params);
    },
    { methodName: method, params: args },
  );
}

async function getPhaseState(page: Page): Promise<any> {
  return page.evaluate(() => window.__BADUGI_E2E__?.getPhaseState?.() ?? null);
}

async function getStateSnapshot(page: Page): Promise<any> {
  return page.evaluate(() => window.__BADUGI_E2E__?.getStateSnapshot?.() ?? null);
}

async function expectHeroCards(page: Page, count: number) {
  for (let idx = 0; idx < count; idx += 1) {
    await expect(page.getByTestId(`player-0-card-${idx}`)).toBeVisible({ timeout: 20000 });
  }
}

async function expectTableNotStuck(page: Page) {
  const decisionPanel = page.getByTestId("decision-panel");
  await expect(decisionPanel).toBeVisible({ timeout: 20000 });
  await expect
    .poll(
      async () => {
        const state = await getPhaseState(page);
        const controller = await getStateSnapshot(page);
        const phase = state?.phase ?? controller?.phase ?? controller?.controllerSnapshot?.phase;
        const turn = state?.turn ?? controller?.turn ?? controller?.controllerSnapshot?.currentActor;
        const players = state?.players ?? controller?.controllerSnapshot?.players ?? [];
        const actor = typeof turn === "number" ? players?.[turn] : null;
        const hero = players?.[0];
        if (phase === "BET" && actor && (actor.allIn || actor.seatOut || actor.folded)) {
          return `stuck-actor-${turn}`;
        }
        if (phase === "BET" && hero?.allIn && turn === 0) {
          return "stuck-hero-all-in";
        }
        return "ok";
      },
      { timeout: 25000 },
    )
    .toBe("ok");
}

async function forceAllInForVariant(page: Page) {
  const snapshot = await getStateSnapshot(page);
  const controllerSnapshot = snapshot?.controllerSnapshot;
  const actor =
    typeof controllerSnapshot?.currentActor === "number"
      ? controllerSnapshot.currentActor
      : typeof (await getPhaseState(page))?.turn === "number"
        ? (await getPhaseState(page)).turn
        : 1;
  const targetSeat = actor === 0 ? 1 : actor;
  if (controllerSnapshot && typeof controllerSnapshot.currentActor === "number") {
    const player = controllerSnapshot.players?.[targetSeat];
    if (player && !player.folded && !player.seatOut && !player.allIn) {
      const amount = Math.max(1, Number(player.stack) || 1);
      await invokeE2E(page, "forceControllerAction", targetSeat, {
        type: "all-in",
        amount,
      });
      return targetSeat;
    }
  }
  await invokeE2E(page, "forceAllIn", targetSeat);
  return targetSeat;
}

async function expectAllInDoesNotTrapTurn(page: Page, targetSeat: number) {
  await expect
    .poll(
      async () => {
        const state = await getPhaseState(page);
        const controller = await getStateSnapshot(page);
        const phase = state?.phase ?? controller?.controllerSnapshot?.phase;
        const turn = state?.turn ?? controller?.controllerSnapshot?.currentActor;
        const players = state?.players ?? controller?.controllerSnapshot?.players ?? [];
        const target = players?.[targetSeat];
        if (!target) return "missing-target";
        if (phase === "BET" && turn === targetSeat && target.allIn) {
          return "trapped";
        }
        return "ok";
      },
      { timeout: 30000 },
    )
    .toBe("ok");
}

test.describe("friend publish candidate regression", () => {
  test.describe.configure({ timeout: 180000 });

  [
    { variant: "badugi", title: /Badugi/i, heroCards: 4 },
    { variant: "nlh", title: /No-Limit Hold'em|NL Hold'em/i, heroCards: 2 },
    { variant: "plo", title: /Pot-Limit Omaha|PLO/i, heroCards: 4 },
    { variant: "D01", title: /2-7 Triple Draw/i, heroCards: 5 },
    { variant: "D02", title: /A-5 Triple Draw/i, heroCards: 5 },
    { variant: "stud", title: /^Stud$/i, heroCards: 3 },
    { variant: "razz", title: /Razz/i, heroCards: 3 },
  ].forEach(({ variant, title, heroCards }) => {
    test(`${variant} survives five hands, all-in, and next hand`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
      await waitForE2EDriver(page);
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 20000 });

      for (let hand = 0; hand < 5; hand += 1) {
        await expectHeroCards(page, heroCards);
        await expectTableNotStuck(page);
        if (hand < 4) {
          await invokeE2E(page, "forceDealNewHandNow");
          await page.waitForTimeout(250);
        }
      }

      const allInSeat = await forceAllInForVariant(page);
      await expectAllInDoesNotTrapTurn(page, allInSeat);
      await invokeE2E(page, "resolveHandNow");
      await page.waitForTimeout(250);
      await invokeE2E(page, "forceDealNewHandNow");
      await expectHeroCards(page, heroCards);
      await expectTableNotStuck(page);
    });
  });
});
