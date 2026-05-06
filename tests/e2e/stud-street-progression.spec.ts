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

async function expectStudVisibilityUi(page: Page, options: { requireSeventhDown?: boolean } = {}) {
  await expect(page.locator('[data-testid$="-stud-summary"]').first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("VISIBLE").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Down\s+\d+/).first()).toBeVisible({ timeout: 15000 });
  if (options.requireSeventhDown) {
    await expect(page.getByText("7TH DOWN").first()).toBeVisible({ timeout: 15000 });
  }
}

function summarizeStudState(state: any) {
  const snapshot = state?.controllerSnapshot;
  const actor = snapshot?.currentActor ?? snapshot?.turn ?? state?.turn;
  const actorState =
    typeof actor === "number" && Array.isArray(snapshot?.players)
      ? snapshot.players[actor]
      : null;
  return JSON.stringify({
    handId: state?.handId,
    phase: state?.phase,
    turn: state?.turn,
    street: snapshot?.street,
    controllerPhase: snapshot?.phase,
    actor,
    actorName: actorState?.name ?? actorState?.playerId ?? null,
    actorStack: actorState?.stack,
    actorBet: actorState?.betThisStreet ?? actorState?.betThisRound,
    actorFolded: actorState?.folded,
    actorAllIn: actorState?.allIn,
    currentBet: snapshot?.currentBet,
    pot: snapshot?.pot,
    lastHandResult: Boolean(snapshot?.lastHandResult),
  });
}

async function isVisibleAndEnabled(page: Page, testId: string) {
  const locator = page.getByTestId(testId).first();
  if (!(await locator.count())) return false;
  if (!(await locator.isVisible().catch(() => false))) return false;
  return locator.isEnabled().catch(() => false);
}

async function clickFirstHeroActionButton(page: Page) {
  const preferredActions = [
    "action-check",
    "action-call",
    "action-allin_call",
    "action-raise",
  ];
  for (const testId of preferredActions) {
    if (await isVisibleAndEnabled(page, testId)) {
      await page.getByTestId(testId).first().click();
      return testId;
    }
  }
  return null;
}

async function playStudHandWithVisibleHeroButtons(page: Page, variant: string, handNumber: number) {
  const visited = new Set<string>();
  let heroButtonClicks = 0;
  let lastProgressKey = "";
  let stableTicks = 0;

  for (let step = 0; step < 260; step += 1) {
    const state = await getE2EState(page);
    const snapshot = state?.controllerSnapshot;
    const street = snapshot?.street;
    if (street) visited.add(street);

    const resultVisible = await page
      .getByTestId("hand-result-pot")
      .first()
      .isVisible()
      .catch(() => false);
    if (
      resultVisible ||
      street === "SHOWDOWN" ||
      snapshot?.lastHandResult ||
      state?.phase === "HAND_RESULT"
    ) {
      await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({
        timeout: 15000,
      });
      return { visited, heroButtonClicks };
    }

    const actor = snapshot?.currentActor ?? snapshot?.turn ?? state?.turn;
    const progressKey = JSON.stringify({
      handId: state?.handId,
      phase: state?.phase,
      street,
      actor,
      currentBet: snapshot?.currentBet,
      pot: snapshot?.pot,
      lastAction:
        typeof actor === "number"
          ? snapshot?.players?.[actor]?.lastAction ?? null
          : null,
    });
    if (progressKey === lastProgressKey) {
      stableTicks += 1;
    } else {
      stableTicks = 0;
      lastProgressKey = progressKey;
    }

    if (actor === 0) {
      await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 10000 });
      const clicked = await clickFirstHeroActionButton(page);
      if (!clicked) {
        throw new Error(
          `${variant} hand ${handNumber} reached hero turn without an enabled action button: ${summarizeStudState(
            state,
          )}`,
        );
      }
      heroButtonClicks += 1;
      await page.waitForTimeout(260);
      continue;
    }

    if (stableTicks > 80) {
      throw new Error(
        `${variant} hand ${handNumber} appears frozen after ${step} steps: ${summarizeStudState(
          state,
        )}`,
      );
    }

    await page.waitForTimeout(240);
  }

  const state = await getE2EState(page);
  throw new Error(
    `${variant} hand ${handNumber} did not reach showdown/result with UI buttons only: ${summarizeStudState(
      state,
    )}`,
  );
}

async function advanceToNextHandWithButton(page: Page, previousHandId: string | null) {
  const nextButton = page.getByRole("button", { name: /next hand/i }).first();
  await expect(nextButton).toBeVisible({ timeout: 15000 });
  await expect(nextButton).toBeEnabled({ timeout: 15000 });
  await nextButton.click();
  await expect(page.getByTestId("hand-result-pot").first()).toBeHidden({ timeout: 15000 });
  await expect
    .poll(
      async () => {
        const state = await getE2EState(page);
        if (!state?.controllerSnapshot) return "missing-controller";
        if (previousHandId && state.handId === previousHandId) return "same-hand";
        return state.controllerSnapshot.street ?? state.phase ?? "unknown";
      },
      { timeout: 20000 },
    )
    .not.toBe("same-hand");
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

async function forceToStudStreet(page: Page, targetStreet: string) {
  const visited = new Set<string>();
  for (let step = 0; step < 120; step += 1) {
    const state = await getE2EState(page);
    const street = state?.controllerSnapshot?.street;
    if (street) visited.add(street);
    if (street === targetStreet) return visited;
    if (street === "SHOWDOWN" || state?.phase === "HAND_RESULT") {
      throw new Error(`Stud-family UI reached ${street} before ${targetStreet}`);
    }
    await forceCurrentStudAction(page);
    await page.waitForTimeout(180);
  }
  throw new Error(`Stud-family UI did not reach ${targetStreet}`);
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
    test(`${variant} completes two consecutive hands from 3rd to 7th with visible hero buttons only`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
      await waitForE2EDriver(page);
      await expectStudVisibilityUi(page);

      for (let hand = 1; hand <= 2; hand += 1) {
        const before = await getE2EState(page);
        const handIdBefore = before?.handId ?? null;
        const result = await playStudHandWithVisibleHeroButtons(page, variant, hand);

        expect(
          [...result.visited],
          `${variant} hand ${hand} visited streets`,
        ).toEqual(
          expect.arrayContaining(["THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "SHOWDOWN"]),
        );
        expect(
          result.heroButtonClicks,
          `${variant} hand ${hand} should exercise at least one real hero action button`,
        ).toBeGreaterThan(0);

        if (hand < 2) {
          await advanceToNextHandWithButton(page, handIdBefore);
        }
      }
    });
  }

  for (const variant of ["stud", "razz"]) {
    test(`${variant} visits every street before showdown`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
      await waitForE2EDriver(page);
      await page.evaluate(() => window.__BADUGI_E2E__?.forceDealNewHandNow?.());
      await page.waitForTimeout(300);

      const visited = await forceToStudStreet(page, "SEVENTH");
      await expectStudVisibilityUi(page, { requireSeventhDown: true });
      const finalVisited = await playForcedStudHand(page);
      for (const street of finalVisited) visited.add(street);

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
