import { expect, test, type Page } from "@playwright/test";
import { APP_URL, gotoWithRetry } from "./authHelper";

function makeCashHand(index: number) {
  const variantId = index % 2 === 0 ? "badugi" : "D01";
  const heroNet = index % 3 === 0 ? 120 : -40;
  const actionType = index % 4 === 0 ? "raise" : "call";
  return {
    handId: `cash-review-${String(index).padStart(2, "0")}`,
    variantId,
    variantName: variantId === "badugi" ? "Badugi" : "2-7 Triple Draw",
    endedAt: Date.now() - index * 1000,
    ts: Date.now() - index * 1000,
    heroNet,
    pot: 160 + index,
    totalPot: 160 + index,
    buttonSeat: 0,
    sbSeat: 1,
    bbSeat: 2,
    seats: [
      {
        seat: 0,
        name: "Hero",
        isHero: true,
        stackAfter: 1000 + heroNet,
        bet: actionType === "raise" ? 40 : 20,
        action: actionType,
        handLabel: "Review low",
        actions: [
          {
            seq: 1,
            street: "BET",
            type: actionType,
            amount: actionType === "raise" ? 40 : 20,
            toCall: 20,
            currentBet: 40,
            stackBefore: 1000,
            stackAfter: 1000 + heroNet,
            legalActions: ["fold", "call", "raise"],
          },
        ],
      },
      {
        seat: 1,
        name: "Sora",
        stackAfter: 900,
        bet: 20,
        action: "call",
      },
    ],
    pots: [
      {
        label: "Main pot",
        amount: 160 + index,
        winners: [{ seat: heroNet >= 0 ? 0 : 1, amount: 160 + index, name: heroNet >= 0 ? "Hero" : "Sora" }],
      },
    ],
    events: [
      {
        type: "BET_ACTION",
        seat: 0,
        action: actionType,
        amount: actionType === "raise" ? 40 : 20,
        actionSeq: 1,
      },
      ...(index % 5 === 0 ? [{ type: "SHOWDOWN" }] : []),
      {
        type: "HAND_END",
        totalPot: 160 + index,
        winners: [{ seat: heroNet >= 0 ? 0 : 1, amount: 160 + index }],
      },
    ],
  };
}

async function openHistoryWithCashHands(page: Page, handCount: number) {
  const hands = Array.from({ length: handCount }, (_, index) => makeCashHand(index));
  await page.addInitScript((fixtureHands) => {
    window.localStorage.setItem("badugi.history.hands", JSON.stringify(fixtureHands));
    window.localStorage.setItem("badugi.history.tournaments", JSON.stringify([]));
    window.localStorage.setItem("badugi.history.tournamentHands", JSON.stringify([]));
    window.localStorage.setItem(
      "mgx_auth",
      JSON.stringify({
        accessToken: "cash-review-e2e-token",
        tokenType: "Bearer",
        user: { id: 901, email: "cash-review-e2e@mgx.test", username: "cash-review-e2e" },
        isAuthenticated: true,
      }),
    );
  }, hands);
  await gotoWithRetry(page, `${APP_URL}dev/history`);
  await expect(page.getByRole("heading", { name: /トーナメント & ハンド履歴/i })).toBeVisible();
  return hands;
}

test.describe("Cash Review history feedback", () => {
  test("keeps the 30 hand Cash Review gate under /history", async ({ page }) => {
    await openHistoryWithCashHands(page, 29);

    await expect(page.getByText(/対象:\s*Cash game/i)).toBeVisible();
    await expect(page.getByText(/Hands:\s*29/i)).toBeVisible();
    await expect(page.getByText(/Minimum:\s*30/i)).toBeVisible();
    await expect(page.getByText("まだフィードバック対象外です。30ハンド以上プレイしてください。")).toBeVisible();
    await expect(page.getByRole("button", { name: "AIフィードバック作成" })).toBeDisabled();
    await expect(page.getByTestId("mtt-result-overlay")).toHaveCount(0);
    await expect(page.getByText("Tournament Review")).toHaveCount(0);
  });

  test("creates Cash/Session Review with mocked play-feedback response at 30 hands", async ({ page }) => {
    const requests: any[] = [];
    await page.route("**/api/analysis/play-feedback", async (route) => {
      const payload = route.request().postDataJSON();
      requests.push(payload);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          source: "playwright-mock",
          adviceJa: [
            "良かった点: 大きなポットを取ったハンドを記録できています。",
            "悪かった点: コールが続いた局面を見直しましょう。",
            "改善点: key handsを中心に次回の参加レンジを確認しましょう。",
          ].join("\n"),
          adviceEn: "Cash/session review fixture.",
        }),
      });
    });

    await openHistoryWithCashHands(page, 30);

    const createButton = page.getByRole("button", { name: "AIフィードバック作成" });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    await expect(page.getByText("Feedback source: playwright-mock")).toBeVisible();
    await expect(page.getByText(/良かった点:/)).toBeVisible();
    await expect(page.getByText(/悪かった点:/)).toBeVisible();
    await expect(page.getByText(/改善点:/)).toBeVisible();
    await expect(page.getByText("Feedback key hands")).toBeVisible();
    await expect(page.getByTestId("cash-review-replay").first()).toBeVisible();

    expect(requests).toHaveLength(1);
    expect(requests[0].mode).toBe("cash");
    expect(requests[0].handCount).toBe(30);
    expect(requests[0].summary?.tournament).toBeNull();
    expect(JSON.stringify(requests[0])).not.toMatch(/placement|payout|bustHand/i);

    await expect(page.getByText("Tournament Review")).toHaveCount(0);
    await expect(page.getByTestId("mtt-result-overlay")).toHaveCount(0);

    await page.getByTestId("cash-review-replay").first().click();
    await expect(page.getByTestId("hand-replay-screen")).toBeVisible({ timeout: 20000 });
    const replayReview = page.getByTestId("replay-review-panel");
    await expect(replayReview).toBeVisible();
    await expect(replayReview).toContainText("Replay Review");
    await expect(replayReview).toContainText("cash");
    await expect(replayReview).not.toContainText(/Tournament Review|Place|Payout/i);
    await expect(page.getByTestId("replay-review-timeline-marker")).toBeVisible();
  });
});
