import { expect, test } from "@playwright/test";
import { APP_URL, gotoWithRetry } from "./authHelper";

test.describe("mobile history screen", () => {
  test("shows stored hand history on a phone viewport without page horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoWithRetry(page, `${APP_URL}dev/menu`);
    await page.evaluate(() => {
      window.localStorage.setItem(
        "badugi.history.hands",
        JSON.stringify([
          {
            handId: "mobile-history-hand-1",
            variantId: "D01",
            variantName: "2-7 Triple Draw",
            endedAt: Date.now(),
            buttonSeat: 0,
            sbSeat: 1,
            bbSeat: 2,
            events: [
              { type: "ACTION", seat: 0, action: "call", amount: 20 },
              { type: "HAND_END", totalPot: 120, winners: [{ seat: 0, amount: 120 }] },
            ],
            seats: [
              {
                seat: 0,
                name: "Hero",
                stackAfter: 620,
                bet: 20,
                action: "call",
                handLabel: "2-7 Low 7-5-4-3-2",
              },
              { seat: 1, name: "Guest", stackAfter: 480, bet: 20, action: "fold" },
            ],
            pots: [
              {
                label: "Main pot",
                amount: 120,
                winners: [{ seat: 0, amount: 120, name: "Hero" }],
              },
            ],
          },
        ]),
      );
    });

    await gotoWithRetry(page, `${APP_URL}dev/history`);

    await expect(page.getByRole("heading", { name: /トーナメント & ハンド履歴/i })).toBeVisible();
    await expect(page.getByText("mobile-history-hand-1")).toBeVisible();
    await expect(page.getByText("2-7 Triple Draw").first()).toBeVisible();

    const metrics = await page.evaluate(() => ({
      horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 2,
      cashSectionVisible: Boolean(
        document.querySelector("section")?.getBoundingClientRect().width,
      ),
    }));
    expect(metrics.horizontalScroll).toBe(false);
    expect(metrics.cashSectionVisible).toBe(true);
  });
});
