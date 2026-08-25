import { expect, test, type Page } from "@playwright/test";
import { APP_URL, gotoWithRetry, openAuthenticatedGame } from "./authHelper";

async function setupTournamentReview(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=badugi&mode=cash&mgxQa=mobile`);
  await page.waitForFunction(
    () => typeof window.__BADUGI_E2E__?.setupTournamentReviewOverlayFixtureForTest === "function",
    undefined,
    { timeout: 60000 },
  );
  await page.evaluate(() =>
    window.__BADUGI_E2E__.setupTournamentReviewOverlayFixtureForTest({
      status: "summary",
      variantId: "badugi",
      withReplayTarget: true,
    }),
  );
}

async function setupShortCashHistory(page: Page) {
  const hands = Array.from({ length: 2 }, (_, index) => ({
    handId: `review-separation-cash-${index}`,
    variantId: "badugi",
    variantName: "Badugi",
    ts: Date.now() - index,
    endedAt: Date.now() - index,
    heroNet: index === 0 ? 60 : -20,
    pot: 100,
    seats: [
      {
        seat: 0,
        isHero: true,
        name: "Hero",
        actions: [{ seq: 1, street: "BET", type: "call", amount: 20 }],
      },
    ],
    events: [
      { type: "ACTION", seat: 0, action: "call", amount: 20 },
      { type: "HAND_END", totalPot: 100, winners: [{ seat: 0, amount: 100 }] },
    ],
  }));
  await page.addInitScript((fixtureHands) => {
    window.localStorage.setItem("badugi.history.hands", JSON.stringify(fixtureHands));
    window.localStorage.setItem("badugi.history.tournaments", JSON.stringify([]));
    window.localStorage.setItem("badugi.history.tournamentHands", JSON.stringify([]));
    window.localStorage.setItem(
      "mgx_auth",
      JSON.stringify({
        accessToken: "review-separation-token",
        tokenType: "Bearer",
        user: { id: 902, email: "review-separation@mgx.test" },
        isAuthenticated: true,
      }),
    );
  }, hands);
  await gotoWithRetry(page, `${APP_URL}dev/history`);
}

test.describe("Review mode separation", () => {
  test("Tournament Review is result-overlay based and does not inherit the Cash Review gate", async ({ page }) => {
    await setupTournamentReview(page);

    await expect(page.getByTestId("mtt-result-overlay")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("mtt-tournament-review")).toBeVisible();
    await expect(page.getByText(/Minimum:\s*30/i)).toHaveCount(0);
    await expect(page.getByText(/30ハンド以上/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "AIフィードバック作成" })).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/history$/);
  });

  test("Cash Review remains history based and does not depend on TournamentResultOverlay", async ({ page }) => {
    await setupShortCashHistory(page);

    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByText(/対象:\s*Cash game/i)).toBeVisible();
    await expect(page.getByText(/Minimum:\s*30/i)).toBeVisible();
    await expect(page.getByText("まだフィードバック対象外です。30ハンド以上プレイしてください。")).toBeVisible();
    await expect(page.getByTestId("mtt-result-overlay")).toHaveCount(0);
    await expect(page.getByText("Tournament Review")).toHaveCount(0);
    await expect(page.getByText(/placement|payout|bust hand/i)).toHaveCount(0);
  });
});
