import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

async function waitForE2EDriver(page: Page) {
  await page.waitForFunction(
    () => {
      const api = window.__BADUGI_E2E__;
      return Boolean(
        api &&
          typeof api.forceControllerAction === "function" &&
          typeof api.getStateSnapshot === "function",
      );
    },
    undefined,
    { timeout: 60000 },
  );
}

async function getE2EState(page: Page): Promise<any> {
  return page.evaluate(() => window.__BADUGI_E2E__?.getStateSnapshot?.() ?? null);
}

async function forceCurrentStudAction(page: Page) {
  const state = await getE2EState(page);
  const snapshot = state?.controllerSnapshot;
  const actor = snapshot?.currentActor;
  if (typeof actor !== "number") return false;
  const player = snapshot?.players?.[actor];
  const toCall = Math.max(0, (snapshot?.currentBet ?? 0) - (player?.betThisStreet ?? 0));
  await page.evaluate(
    ({ seat, payload }) => window.__BADUGI_E2E__?.forceControllerAction?.(seat, payload),
    {
      seat: actor,
      payload: {
        type: toCall > 0 ? "call" : "check",
        amount: toCall,
      },
    },
  );
  return true;
}

async function playForcedStudHand(page: Page) {
  const visited = new Set<string>();
  for (let step = 0; step < 120; step += 1) {
    const state = await getE2EState(page);
    const snapshot = state?.controllerSnapshot;
    if (snapshot?.street) visited.add(snapshot.street);
    if (snapshot?.street === "SHOWDOWN" || snapshot?.lastHandResult || state?.phase === "HAND_RESULT") {
      return visited;
    }
    const streetBefore = snapshot?.street;
    const acted = await forceCurrentStudAction(page);
    if (!acted) {
      await page.waitForTimeout(180);
      continue;
    }
    await page.waitForTimeout(140);
    const after = await getE2EState(page);
    const streetAfter = after?.controllerSnapshot?.street;
    if (streetAfter) visited.add(streetAfter);
    if (streetAfter && streetAfter !== streetBefore && streetAfter !== "SHOWDOWN") {
      await page.waitForTimeout(950);
      const paused = await getE2EState(page);
      if (paused?.controllerSnapshot?.street) visited.add(paused.controllerSnapshot.street);
    }
  }
  throw new Error("Stud-family UI hand did not reach showdown");
}

async function advanceToHeroStudCallSpot(page: Page) {
  for (let step = 0; step < 80; step += 1) {
    const state = await getE2EState(page);
    const snapshot = state?.controllerSnapshot;
    const actor = snapshot?.currentActor;
    if (typeof actor !== "number") {
      await page.waitForTimeout(160);
      continue;
    }
    const player = snapshot?.players?.[actor];
    const currentBet = Number(snapshot?.currentBet ?? 0);
    const actorBet = Number(player?.betThisStreet ?? player?.betThisRound ?? 0);
    const toCall = Math.max(0, currentBet - actorBet);
    if (actor === 0 && toCall > 0) {
      return { currentBet, toCall, street: snapshot?.street };
    }
    const actionType =
      toCall > 0 ? "call" : snapshot?.street === "THIRD" ? "complete" : "bet";
    const amount = toCall > 0 ? toCall : Math.max(10, currentBet || 10);
    await page.evaluate(
      ({ seat, payload }) => window.__BADUGI_E2E__?.forceControllerAction?.(seat, payload),
      {
        seat: actor,
        payload: { type: actionType, amount },
      },
    );
    await page.waitForTimeout(160);
  }
  throw new Error("Stud UI did not reach a hero call spot");
}

test.describe("Stud-family street progression UI", () => {
  test.describe.configure({ timeout: 120000 });

  for (const variant of ["stud", "razz"]) {
    test(`${variant} visits every street before showdown`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
      await waitForE2EDriver(page);
      await page.evaluate(() => window.__BADUGI_E2E__?.forceDealNewHandNow?.());
      await page.waitForTimeout(300);

      const visited = await playForcedStudHand(page);

      expect([...visited]).toEqual(
        expect.arrayContaining(["THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "SHOWDOWN"]),
      );
    });
  }

  test("Stud does not jump to showdown immediately after a visible street check", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page, `${APP_URL}?variant=stud`);
    await waitForE2EDriver(page);

    for (let step = 0; step < 60; step += 1) {
      const state = await getE2EState(page);
      const street = state?.controllerSnapshot?.street;
      if (street === "FOURTH" || street === "FIFTH" || street === "SIXTH" || street === "SEVENTH") {
        await forceCurrentStudAction(page);
        await page.waitForTimeout(300);
        const after = await getE2EState(page);
        expect(after?.controllerSnapshot?.street).not.toBe("SHOWDOWN");
        expect(after?.phase).not.toBe("HAND_RESULT");
        return;
      }
      await forceCurrentStudAction(page);
      await page.waitForTimeout(140);
    }
    throw new Error("Stud UI did not reach a visible post-third street");
  });

  test("Stud Call button advances controller turn without leaving hero stuck", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page, `${APP_URL}?variant=stud`);
    await waitForE2EDriver(page);
    await page.evaluate(() => window.__BADUGI_E2E__?.forceDealNewHandNow?.());
    await page.waitForTimeout(300);

    const callSpot = await advanceToHeroStudCallSpot(page);
    expect(callSpot.toCall).toBeGreaterThan(0);

    const callButton = page.getByTestId("action-call");
    await expect(callButton).toBeVisible({ timeout: 10000 });
    await expect(callButton).toBeEnabled({ timeout: 10000 });
    await callButton.click();

    await expect
      .poll(
        async () => {
          const state = await getE2EState(page);
          const snapshot = state?.controllerSnapshot;
          const hero = snapshot?.players?.[0];
          const toCall = Math.max(
            0,
            Number(snapshot?.currentBet ?? 0) -
              Number(hero?.betThisStreet ?? hero?.betThisRound ?? 0),
          );
          if (snapshot?.currentActor === 0 && toCall > 0) return "stuck";
          return "advanced";
        },
        { timeout: 10000 },
      )
      .toBe("advanced");
  });
});
