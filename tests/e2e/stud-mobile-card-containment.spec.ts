import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  APP_URL,
  dismissTranslateOverlay,
  enterTitleIfPresent,
  gotoWithRetry,
} from "./authHelper";

async function openLocallyAuthenticatedStudGame(page: Page, variant: string) {
  const user = {
    id: "stud-layout-e2e",
    username: "Stud Layout QA",
    email: "stud-layout-e2e@mgx.local",
  };
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
  });
  await page.route("**/api/history/hand", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/badugi/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.addInitScript((authUser) => {
    window.localStorage.setItem(
      "mgx_auth",
      JSON.stringify({
        accessToken: "stud-layout-e2e-token",
        tokenType: "Bearer",
        user: authUser,
        isAuthenticated: true,
      }),
    );
  }, user);

  await gotoWithRetry(page, `${APP_URL}?variant=${variant}&previewVariants=1`);
  await dismissTranslateOverlay(page);
  await enterTitleIfPresent(page);
  await page.getByTestId("menu-ring").waitFor({ state: "visible", timeout: 20000 });
  await page.getByTestId("menu-ring").click();

  const playButton = page.getByTestId(`game-selector-play-${variant}`).first();
  if (!(await playButton.count())) {
    await page.getByRole("button", { name: /Stud|スタッド/i }).first().click();
  }
  await playButton.click();
  const portraitOverride = page.getByRole("button", { name: /横向き表示を試す|try landscape/i });
  if (await portraitOverride.isVisible().catch(() => false)) {
    await portraitOverride.click();
  }
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 20000 });
}

async function forceToSeventhStreet(page: Page) {
  await page.waitForFunction(
    () => typeof window.__BADUGI_E2E__?.forceControllerAction === "function",
    undefined,
    { timeout: 20000 },
  );

  for (let step = 0; step < 120; step += 1) {
    const state = await page.evaluate(() => window.__BADUGI_E2E__?.getStateSnapshot?.() ?? null);
    const snapshot = state?.controllerSnapshot;
    if (snapshot?.street === "SEVENTH") return;
    if (snapshot?.street === "SHOWDOWN" || state?.phase === "HAND_RESULT") {
      throw new Error("Stud-family hand reached showdown before seventh street");
    }
    const actor = snapshot?.currentActor;
    if (typeof actor === "number") {
      const player = snapshot?.players?.[actor];
      const toCall = Math.max(0, (snapshot?.currentBet ?? 0) - (player?.betThisStreet ?? 0));
      await page.evaluate(
        ({ seat, amount }) =>
          window.__BADUGI_E2E__?.forceControllerAction?.(seat, {
            type: amount > 0 ? "call" : "check",
            amount,
          }),
        { seat: actor, amount: toCall },
      );
    }
    await page.waitForTimeout(180);
  }
  throw new Error("Stud-family hand did not reach seventh street");
}

async function playStudHandToResult(page: Page, handNumber: number) {
  const visited = new Set<string>();
  let heroButtonClicks = 0;
  let previousSignature = "";
  let repeated = 0;

  for (let step = 0; step < 180; step += 1) {
    const state = await page.evaluate(() => window.__BADUGI_E2E__?.getStateSnapshot?.() ?? null);
    const snapshot = state?.controllerSnapshot;
    if (snapshot?.street) visited.add(snapshot.street);
    if (snapshot?.lastHandResult || snapshot?.street === "SHOWDOWN" || state?.phase === "HAND_RESULT") {
      await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 15000 });
      return { state, visited, heroButtonClicks };
    }

    const actor = snapshot?.currentActor;
    const player = typeof actor === "number" ? snapshot?.players?.[actor] : null;
    const toCall = Math.max(0, (snapshot?.currentBet ?? 0) - (player?.betThisStreet ?? 0));
    const signature = JSON.stringify({
      street: snapshot?.street,
      actor,
      currentBet: snapshot?.currentBet,
      pot: snapshot?.pot,
      stacks: snapshot?.players?.map((seat) => seat?.stack),
      bets: snapshot?.players?.map((seat) => seat?.betThisStreet),
    });
    repeated = signature === previousSignature ? repeated + 1 : 0;
    previousSignature = signature;
    if (repeated >= 30) {
      throw new Error(`Hand ${handNumber} froze at ${signature}`);
    }

    if (actor === 0) {
      const action = page
        .locator(
          "[data-testid='action-check'],[data-testid='action-call'],[data-testid='action-raise'],[data-testid='action-fold']",
        )
        .filter({ visible: true })
        .first();
      await expect(action).toBeVisible({ timeout: 10000 });
      await expect(action).toBeEnabled({ timeout: 10000 });
      await action.click();
      heroButtonClicks += 1;
    } else if (typeof actor === "number") {
      await page.evaluate(
        ({ seat, amount }) =>
          window.__BADUGI_E2E__?.forceControllerAction?.(seat, {
            type: amount > 0 ? "call" : "check",
            amount,
          }),
        { seat: actor, amount: toCall },
      );
    }
    await page.waitForTimeout(80);
  }
  throw new Error(`Hand ${handNumber} did not reach a result`);
}

function getDeviceViewports(testInfo: TestInfo) {
  if (testInfo.project.name === "stud-android-chromium") {
    return {
      initial: { width: 412, height: 915 },
      rotated: { width: 915, height: 412 },
    };
  }
  if (testInfo.project.name === "stud-iphone-webkit") {
    return {
      initial: { width: 390, height: 844 },
      rotated: { width: 844, height: 390 },
    };
  }
  if (testInfo.project.name === "stud-desktop-chromium") {
    return {
      initial: { width: 1440, height: 900 },
      rotated: { width: 1280, height: 720 },
    };
  }
  return null;
}

async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    visualViewportWidth: window.visualViewport?.width ?? window.innerWidth,
  }));
  expect(geometry.documentWidth).toBeLessThanOrEqual(
    Math.ceil(Math.max(geometry.viewportWidth, geometry.visualViewportWidth)) + 1,
  );
}

async function advanceToNextHand(page: Page, previousHandId: string | null) {
  const nextButton = page.getByRole("button", { name: /next hand|次のハンド/i }).first();
  await expect(nextButton).toBeVisible({ timeout: 15000 });
  await nextButton.click();
  await expect(page.getByTestId("hand-result-pot").first()).toBeHidden({ timeout: 15000 });
  await expect
    .poll(
      async () => {
        const state = await page.evaluate(() => window.__BADUGI_E2E__?.getStateSnapshot?.() ?? null);
        return state?.handId && state.handId !== previousHandId ? state.handId : null;
      },
      { timeout: 20000 },
    )
    .not.toBeNull();
}

async function expectEveryCardInsideItsSeat(page: Page) {
  for (let seatIndex = 0; seatIndex < 6; seatIndex += 1) {
    const seat = page.getByTestId(`seat-${seatIndex}`);
    const row = page.getByTestId(`player-${seatIndex}-card-row`);
    await expect(seat).toBeVisible({ timeout: 20000 });
    await expect(row).toBeVisible({ timeout: 20000 });

    const geometry = await seat.evaluate((seatElement, currentSeatIndex) => {
      const seatRect = seatElement.getBoundingClientRect();
      const cardRow = seatElement.querySelector(
        `[data-testid="player-${currentSeatIndex}-card-row"]`,
      );
      const cardRects = Array.from(cardRow?.children ?? []).map((card) => {
        const rect = card.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      });
      return {
        seat: {
          left: seatRect.left,
          right: seatRect.right,
          top: seatRect.top,
          bottom: seatRect.bottom,
        },
        cards: cardRects,
      };
    }, seatIndex);

    expect(geometry.cards.length).toBeGreaterThanOrEqual(3);
    geometry.cards.forEach((card) => {
      expect(card.left).toBeGreaterThanOrEqual(geometry.seat.left - 1);
      expect(card.right).toBeLessThanOrEqual(geometry.seat.right + 1);
      expect(card.top).toBeGreaterThanOrEqual(geometry.seat.top - 1);
      expect(card.bottom).toBeLessThanOrEqual(geometry.seat.bottom + 1);
    });
  }
}

test.describe("Stud-family mobile card containment", () => {
  test.describe.configure({ timeout: 300000 });

  [
    { variant: "stud8", viewport: { width: 390, height: 844 } },
    { variant: "razz", viewport: { width: 844, height: 390 } },
  ].forEach(({ variant, viewport }) => {
    test(`${variant} keeps all cards inside player panels at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openLocallyAuthenticatedStudGame(page, variant);
      await expect(page.getByTestId("player-0-card-0")).toBeVisible({ timeout: 20000 });

      await expectEveryCardInsideItsSeat(page);

      await forceToSeventhStreet(page);
      await expect(page.getByTestId("player-0-card-row").locator(":scope > *")).toHaveCount(7);
      await expectEveryCardInsideItsSeat(page);

      const heroPartialBackOverlays = await page
        .getByTestId("player-0-card-row")
        .locator('[style*="polygon"]')
        .count();
      expect(heroPartialBackOverlays).toBe(0);
    });
  });

  ["stud8", "razz"].forEach((variant) => {
    test(`${variant} completes 20 browser hands with real Hero buttons`, async ({ page }, testInfo) => {
      const deviceViewports = getDeviceViewports(testInfo);
      const fallbackViewport =
        variant === "stud8" ? { width: 390, height: 844 } : { width: 844, height: 390 };
      await page.setViewportSize(deviceViewports?.initial ?? fallbackViewport);
      await openLocallyAuthenticatedStudGame(page, variant);

      let totalHeroButtonClicks = 0;

      for (let handNumber = 1; handNumber <= 20; handNumber += 1) {
        if (handNumber === 11 && deviceViewports) {
          await page.setViewportSize(deviceViewports.rotated);
          await page.waitForTimeout(300);
        }
        const { state, visited, heroButtonClicks } = await playStudHandToResult(page, handNumber);
        totalHeroButtonClicks += heroButtonClicks;
        expect(
          [...visited],
          `${variant} hand ${handNumber} should visit every Stud street`,
        ).toEqual(
          expect.arrayContaining(["THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "SHOWDOWN"]),
        );
        await expectNoHorizontalOverflow(page);
        if (handNumber < 20) {
          await advanceToNextHand(page, state?.handId ?? null);
        }
      }
      expect(totalHeroButtonClicks).toBeGreaterThan(0);
    });
  });
});
