import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  auditHandReplayFidelity,
  replayHandFromHistory,
} from "../../src/games/badugi/flow/handReplay.js";
import { validateReplayReadyHandHistory } from "../../src/ui/utils/handHistoryReplayRequirements.js";
import {
  APP_URL,
  dismissTranslateOverlay,
  enterTitleIfPresent,
  gotoWithRetry,
} from "./authHelper";

const STUD_RELEASE_CASES = [
  { variant: "stud", minimumHands: 10 },
  { variant: "stud8", minimumHands: 20 },
  { variant: "razz", minimumHands: 20 },
  { variant: "razzdugi", minimumHands: 10 },
  { variant: "razzducey", minimumHands: 10 },
  { variant: "razz27", minimumHands: 10 },
] as const;

const SPLIT_STUD_VARIANTS = new Set(["stud8", "razzdugi", "razzducey"]);

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
  let bringInObserved = false;
  let previousSignature = "";
  let repeated = 0;

  for (let step = 0; step < 180; step += 1) {
    const state = await page.evaluate(() => window.__BADUGI_E2E__?.getStateSnapshot?.() ?? null);
    const snapshot = state?.controllerSnapshot;
    if (snapshot?.street) visited.add(snapshot.street);
    if (
      snapshot?.street === "THIRD" &&
      Number.isInteger(snapshot?.bringInIndex) &&
      Number(snapshot?.bringInAmount) > 0 &&
      Number(snapshot?.completeAmount) >= Number(snapshot?.bringInAmount)
    ) {
      bringInObserved = true;
    }
    if (snapshot?.lastHandResult) {
      const resultOverlay = page.getByTestId("hand-result-overlay");
      if (await resultOverlay.isVisible().catch(() => false)) {
        await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 15000 });
        return { state, visited, heroButtonClicks, bringInObserved };
      }
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
      const actionCandidates = [
        page.getByTestId("action-check"),
        page.getByTestId("action-call"),
        page.getByTestId("action-raise"),
      ];
      let action = actionCandidates[0];
      for (const candidate of actionCandidates) {
        if (await candidate.isVisible().catch(() => false)) {
          action = candidate;
          break;
        }
      }
      await expect(action).toBeVisible({ timeout: 10000 });
      await expect(action).toBeEnabled({ timeout: 10000 });
      const actionGeometry = await action.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const viewport = window.visualViewport ?? {
          offsetLeft: 0,
          offsetTop: 0,
          width: window.innerWidth,
          height: window.innerHeight,
        };
        return {
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          viewportLeft: viewport.offsetLeft,
          viewportTop: viewport.offsetTop,
          viewportRight: viewport.offsetLeft + viewport.width,
          viewportBottom: viewport.offsetTop + viewport.height,
        };
      });
      expect(actionGeometry.left).toBeGreaterThanOrEqual(actionGeometry.viewportLeft - 1);
      expect(actionGeometry.top).toBeGreaterThanOrEqual(actionGeometry.viewportTop - 1);
      expect(actionGeometry.right).toBeLessThanOrEqual(actionGeometry.viewportRight + 1);
      expect(actionGeometry.bottom).toBeLessThanOrEqual(actionGeometry.viewportBottom + 1);
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

async function expectEveryCardInsideItsSeat(page: Page, minimumCards = 3) {
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

    expect(geometry.cards.length).toBeGreaterThanOrEqual(minimumCards);
    geometry.cards.forEach((card) => {
      expect(card.left).toBeGreaterThanOrEqual(geometry.seat.left - 1);
      expect(card.right).toBeLessThanOrEqual(geometry.seat.right + 1);
      expect(card.top).toBeGreaterThanOrEqual(geometry.seat.top - 1);
      expect(card.bottom).toBeLessThanOrEqual(geometry.seat.bottom + 1);
    });
  }
}

async function verifyStudHistoryAndReplay(page: Page, expectedHandIds: string[]) {
  const records = await page.evaluate(() => {
    const memory = window.__BADUGI_E2E__?.getHandHistory?.() ?? [];
    let persisted = [];
    try {
      persisted = JSON.parse(window.localStorage.getItem("badugi.history.hands") ?? "[]");
    } catch {
      persisted = [];
    }
    const seen = new Set();
    return [...persisted, ...memory].filter((record) => {
      if (!record?.handId || seen.has(record.handId)) return false;
      seen.add(record.handId);
      return true;
    });
  });
  const selected = expectedHandIds.map((handId) =>
    records.find((record: any) => record?.handId === handId),
  );
  expect(selected.filter(Boolean)).toHaveLength(expectedHandIds.length);
  for (const record of selected) {
    const replayReady = validateReplayReadyHandHistory(record, {
      variantId: record.variantId,
    });
    expect(
      replayReady.valid,
      `${record.handId} is not replay-ready: ${replayReady.missing.join(", ")}`,
    ).toBe(true);
    const fidelity = auditHandReplayFidelity(record);
    expect(
      fidelity.valid,
      `${record.handId} replay differs from the played hand: ${JSON.stringify(fidelity.issues)}`,
    ).toBe(true);
    const replayFrames = replayHandFromHistory(record);
    const terminalFrame = replayFrames.at(-1);
    const replayCardTrace = replayFrames.map((frame) => ({
      phase: frame.phase,
      cards: frame.players?.map((player) => player.hand?.length ?? 0),
    }));
    expect(
      terminalFrame?.players?.every((player) => player.folded || player.hand?.length === 7),
      `${record.handId} replay must preserve all seven cards for every live seat: ${JSON.stringify(replayCardTrace)}`,
    ).toBe(true);
  }

  const lastHandId = expectedHandIds.at(-1)!;
  await page.getByTestId("hand-result-history").click({ timeout: 5_000 });
  const modal = page.getByTestId("game-utility-modal");
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await expect(modal.getByTestId(`hand-history-row-${lastHandId}`)).toBeVisible();
  await modal.getByTestId(`hand-history-row-${lastHandId}`).click();
  await expect(page.getByTestId("hand-replay-screen")).toBeVisible({ timeout: 10_000 });
  const counter = page.getByTestId("replay-frame-counter");
  await expect(counter).toContainText(/Frame 1 \/ \d+/, { timeout: 5_000 });
  const frameCount = Number(((await counter.textContent()) ?? "").match(/Frame 1 \/ (\d+)/)?.[1] ?? 0);
  expect(frameCount).toBeGreaterThan(1);
  await page.getByTestId("replay-last-frame").click({ timeout: 5_000 });
  await expect(page.getByText(/Awarded pot:/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Back to History/i }).click();
  await expect(page.getByTestId("hand-result-overlay")).toBeVisible({ timeout: 10_000 });
}

test.describe("Stud-family mobile card containment", () => {
  test.describe.configure({ timeout: 300000 });

  STUD_RELEASE_CASES.forEach(({ variant }, caseIndex) => {
    const viewport = caseIndex % 2 === 0
      ? { width: 390, height: 844 }
      : { width: 844, height: 390 };
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

  STUD_RELEASE_CASES.forEach(({ variant, minimumHands }) => {
    test(`${variant} completes ${minimumHands} browser hands with real Hero buttons`, async ({ page }, testInfo) => {
      const deviceViewports = getDeviceViewports(testInfo);
      const fallbackViewport =
        variant === "stud8" ? { width: 390, height: 844 } : { width: 844, height: 390 };
      await page.setViewportSize(deviceViewports?.initial ?? fallbackViewport);
      await openLocallyAuthenticatedStudGame(page, variant);
      await expectEveryCardInsideItsSeat(page);

      let totalHeroButtonClicks = 0;
      const completedHandIds: string[] = [];

      for (let handNumber = 1; handNumber <= minimumHands; handNumber += 1) {
        if (handNumber === Math.floor(minimumHands / 2) + 1 && deviceViewports) {
          await page.setViewportSize(deviceViewports.rotated);
          await page.waitForTimeout(300);
        }
        const { state, visited, heroButtonClicks, bringInObserved } =
          await playStudHandToResult(page, handNumber);
        totalHeroButtonClicks += heroButtonClicks;
        expect(bringInObserved, `${variant} hand ${handNumber} must post a bring-in`).toBe(true);
        expect(
          [...visited],
          `${variant} hand ${handNumber} should visit every Stud street`,
        ).toEqual(
          expect.arrayContaining(["THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "SHOWDOWN"]),
        );
        const handId = String(state?.handId ?? "");
        expect(handId).not.toBe("");
        completedHandIds.push(handId);
        await expectEveryCardInsideItsSeat(page, 7);
        if (SPLIT_STUD_VARIANTS.has(variant)) {
          await expect(page.getByTestId("hand-result-component-detail").first()).toBeVisible();
        }
        await expectNoHorizontalOverflow(page);
        if (handNumber < minimumHands) {
          await advanceToNextHand(page, state?.handId ?? null);
        }
      }
      expect(totalHeroButtonClicks).toBeGreaterThan(0);
      expect(new Set(completedHandIds).size).toBe(minimumHands);
      await verifyStudHistoryAndReplay(page, completedHandIds);
    });
  });
});
