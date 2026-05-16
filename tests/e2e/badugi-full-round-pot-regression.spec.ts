import { test, expect, Page } from "@playwright/test";
import { openAuthenticatedGame } from "./authHelper";

async function openBadugiPreview(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page);
}

async function getPhaseState(page: Page) {
  return page.evaluate(() => window.__BADUGI_E2E__?.getPhaseState?.() ?? null);
}

async function invokeE2E(page: Page, method: string, ...args: unknown[]) {
  await page.evaluate(
    ({ methodName, params }) => {
      const api = window.__BADUGI_E2E__;
      if (!api || typeof api[methodName] !== "function") {
        throw new Error(`E2E helper ${methodName} is not available`);
      }
      api[methodName](...params);
    },
    { methodName: method, params: args },
  );
}

async function forceContinueAction(page: Page, seat: number) {
  const state = await getPhaseState(page);
  const players = Array.isArray(state?.players) ? state.players : [];
  const currentBet = players.reduce(
    (max: number, player: any) =>
      Math.max(max, typeof player?.betThisRound === "number" ? player.betThisRound : 0),
    0,
  );
  const seatBet = typeof players?.[seat]?.betThisRound === "number" ? players[seat].betThisRound : 0;
  await invokeE2E(page, "forceSeatAction", seat, {
    type: currentBet > seatBet ? "call" : "check",
  });
}

async function visibleTotalPot(page: Page) {
  return page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    const match = text.match(/Total Pot\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  });
}

test.describe("Badugi full-round pot regression", () => {
  test("keeps pot visible and reaches hand result through natural 3-draw browser flow", async ({ page }) => {
    await openBadugiPreview(page);
    await page.waitForFunction(() => typeof window.__BADUGI_E2E__?.getPhaseState === "function");

    const initialPot = await visibleTotalPot(page);
    expect(initialPot).not.toBeNull();
    expect(initialPot ?? 0).toBeGreaterThan(0);

    const deadline = Date.now() + 95000;
    let observedPostDrawBet = false;
    let minActivePot = Number.POSITIVE_INFINITY;

    while (Date.now() < deadline) {
      if (await page.locator("text=Hand Result").first().isVisible().catch(() => false)) {
        break;
      }
      const state = await getPhaseState(page);
      const players = Array.isArray(state?.players) ? state.players : [];
      const hero = players[0] ?? null;
      const currentBet = players.reduce(
        (max: number, player: any) =>
          Math.max(max, typeof player?.betThisRound === "number" ? player.betThisRound : 0),
        0,
      );
      const pot = await visibleTotalPot(page);
      if ((state?.phase === "BET" || state?.phase === "DRAW") && pot != null) {
        minActivePot = Math.min(minActivePot, pot);
        expect(pot).toBeGreaterThan(0);
      }
      if (state?.phase === "BET" && Number(state?.drawRound) >= 1) {
        observedPostDrawBet = true;
      }
      if (
        state?.phase === "BET" &&
        state?.turn === 0 &&
        hero?.hasActedThisRound &&
        hero?.lastAction === "Check" &&
        currentBet === (hero?.betThisRound ?? 0)
      ) {
        throw new Error("stale hero acting state after completed check");
      }
      if (state?.turn === 0 && state?.phase === "DRAW") {
        await invokeE2E(page, "forceHeroDraw");
        await page.waitForTimeout(180);
        continue;
      }
      if (state?.turn === 0 && state?.phase === "BET") {
        await forceContinueAction(page, 0);
        await page.waitForTimeout(120);
        continue;
      }
      await page.waitForTimeout(120);
    }

    await expect(page.locator("text=Hand Result").first()).toBeVisible({ timeout: 1000 });
    expect(observedPostDrawBet).toBe(true);
    expect(minActivePot).toBeGreaterThan(0);
  });
});
