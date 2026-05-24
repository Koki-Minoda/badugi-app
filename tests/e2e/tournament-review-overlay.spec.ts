import { expect, test, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

type ReviewStatus = "summary" | "insufficient_logs" | "error";

async function openTournamentReviewFixture(
  page: Page,
  {
    status = "summary",
    variantId = "badugi",
    withReplayTarget = true,
    viewport = { width: 390, height: 844 },
  }: {
    status?: ReviewStatus;
    variantId?: string;
    withReplayTarget?: boolean;
    viewport?: { width: number; height: number };
  } = {},
) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await page.setViewportSize(viewport);
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variantId}&mode=cash&mgxQa=mobile`);
  await page.waitForFunction(
    () =>
      typeof window.__BADUGI_E2E__?.setupTournamentReviewOverlayFixtureForTest ===
        "function" &&
      typeof window.__BADUGI_E2E__?.getReplayState === "function",
    undefined,
    { timeout: 60000 },
  );
  return page.evaluate(
    ({ nextStatus, nextVariantId, nextWithReplayTarget }) =>
      window.__BADUGI_E2E__.setupTournamentReviewOverlayFixtureForTest({
        status: nextStatus,
        variantId: nextVariantId,
        withReplayTarget: nextWithReplayTarget,
      }),
    {
      nextStatus: status,
      nextVariantId: variantId,
      nextWithReplayTarget: withReplayTarget,
    },
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
}

test.describe("Tournament Review result overlay", () => {
  test.describe.configure({ timeout: 120000 });

  test("summary review shows result, key hands, replay CTA, and opens replay on mobile portrait", async ({ page }) => {
    const fixture = await openTournamentReviewFixture(page, {
      status: "summary",
      variantId: "badugi",
      withReplayTarget: true,
      viewport: { width: 390, height: 844 },
    });

    const overlay = page.getByTestId("mtt-result-overlay");
    await expect(overlay).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("mtt-tournament-review")).toBeVisible();
    await expect(page.getByRole("button", { name: "AIレビューを見る" })).toHaveCount(0);
    await expect(page.getByTestId("mtt-result-champion")).toContainText("Champion");
    await expect(page.getByTestId("mtt-result-row")).toHaveCount(3);
    await expect(page.getByTestId("mtt-result-payout").first()).toContainText(/Payout \d+/);

    const review = page.getByTestId("mtt-tournament-review");
    await expect(review).toContainText("Tournament Review");
    await expect(review).toContainText("簡易レビュー");
    await expect(review).toContainText("Place");
    await expect(review).toContainText("Payout");
    await expect(review).toContainText("Hands");
    await expect(review).toContainText("3");
    await expect(review).toContainText("badugi");
    await expect(page.getByTestId("mtt-tournament-review-key-hand").first()).toBeVisible();
    const phrase = (...codes: number[]) => String.fromCharCode(...codes);
    const forbiddenClaims = new RegExp(
      [
        phrase(71, 84, 79),
        `${phrase(80, 114, 111)} ${phrase(98, 97, 115, 101, 108, 105, 110, 101)}`,
        `${phrase(101, 120, 97, 99, 116)} ${phrase(69, 86)}`,
      ].join("|"),
      "i",
    );
    await expect(review).not.toContainText(forbiddenClaims);

    const replayCta = page.getByTestId("mtt-tournament-review-replay").first();
    await expect(replayCta).toBeVisible();

    await expectNoHorizontalOverflow(page);
    const reviewBox = await review.boundingBox();
    expect(reviewBox).toBeTruthy();
    expect(reviewBox!.x).toBeGreaterThanOrEqual(0);
    expect(reviewBox!.x + reviewBox!.width).toBeLessThanOrEqual(390);

    await replayCta.click();
    await expect(page.getByTestId("hand-replay-screen")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("replay-review-panel")).toBeVisible();
    await expect(page.getByTestId("replay-review-panel")).toContainText("Replay Review");
    await expect(page.getByTestId("replay-review-reason")).toBeVisible();
    await expect(page.getByTestId("replay-review-timeline-marker")).toBeVisible();
    const replayState = await page.evaluate(() => window.__BADUGI_E2E__?.getReplayState?.() ?? null);
    expect(replayState?.currentScreen).toBe("handReplay");
    expect(replayState?.replayTarget?.handId).toBe(fixture.review.keyHands[0].handId);
    expect(replayState?.replayTarget?.replayReview?.reviewMode).toBe("tournament");
  });

  test("insufficient logs and error states render without breaking champion or payout UI", async ({ page }) => {
    await openTournamentReviewFixture(page, {
      status: "insufficient_logs",
      variantId: "badugi",
      withReplayTarget: true,
    });

    await expect(page.getByTestId("mtt-result-overlay")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("mtt-tournament-review-status")).toContainText("簡易レビューのみ");
    await expect(page.getByTestId("mtt-tournament-review")).toContainText("ハンド履歴が少ないため");
    await expect(page.getByTestId("mtt-result-champion")).toContainText("Champion");
    await expect(page.getByTestId("mtt-result-payout").first()).toContainText(/Payout \d+/);

    await page.evaluate(() =>
      window.__BADUGI_E2E__.setupTournamentReviewOverlayFixtureForTest({
        status: "error",
        variantId: "badugi",
        withReplayTarget: true,
      }),
    );

    await expect(page.getByTestId("mtt-tournament-review-status")).toContainText("レビュー未作成");
    await expect(page.getByTestId("mtt-tournament-review")).toContainText("レビューを作成できませんでした");
    await expect(page.getByTestId("mtt-result-champion")).toContainText("Champion");
    await expect(page.getByTestId("mtt-result-payout").first()).toContainText(/Payout \d+/);
  });

  test("Replay CTA is hidden when key hands have no replay target", async ({ page }) => {
    await openTournamentReviewFixture(page, {
      status: "summary",
      variantId: "badugi",
      withReplayTarget: false,
    });

    await expect(page.getByTestId("mtt-result-overlay")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("mtt-tournament-review-key-hand").first()).toBeVisible();
    await expect(page.getByTestId("mtt-tournament-review-replay")).toHaveCount(0);
  });

  test("Badugi, A-5 TD, and 2-7 TD tournament review smoke", async ({ page }) => {
    for (const variantId of ["badugi", "D02", "D01"]) {
      await openTournamentReviewFixture(page, {
        status: "summary",
        variantId,
        withReplayTarget: true,
        viewport: { width: 430, height: 932 },
      });

      await expect(page.getByTestId("mtt-result-overlay")).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId("mtt-tournament-review")).toBeVisible();
      await expect(page.getByTestId("mtt-tournament-review")).toContainText(variantId);
      await expect(page.getByTestId("mtt-tournament-review-key-hand").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });
});
