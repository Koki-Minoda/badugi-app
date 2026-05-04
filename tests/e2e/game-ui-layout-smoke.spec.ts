import { test, expect } from "@playwright/test";
import { openAuthenticatedGame } from "./authHelper";

test.describe("game UI layout smoke", () => {
  test.describe.configure({ timeout: 90000 });

  test("keeps table ledger, decision panel, hero cards, and seat detail usable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page);

    const ledger = page.getByTestId("table-status-ledger");
    const summary = page.getByTestId("table-summary-panel");
    const decisionPanel = page.getByTestId("decision-panel");
    const actionContext = page.getByTestId("action-context-panel");
    const heroCard = page.getByTestId("player-0-card-0");
    const cpuSeat = page.getByTestId("seat-3");
    const cpuDetail = page.getByTestId("seat-3-detail");

    await expect(ledger).toBeVisible();
    await expect(summary).toBeVisible();
    await expect(decisionPanel).toBeVisible();
    await expect(actionContext).toBeVisible();
    await expect(actionContext.getByText(/To Call/i)).toBeVisible();
    await expect(actionContext.getByText(/Raise Cap/i)).toBeVisible();
    await expect(heroCard).toBeVisible();
    await expect(ledger.getByText(/Total Pot/i)).toBeVisible();

    const [ledgerBox, decisionBox, heroCardBox] = await Promise.all([
      ledger.boundingBox(),
      decisionPanel.boundingBox(),
      heroCard.boundingBox(),
    ]);

    expect(ledgerBox?.width ?? 0).toBeGreaterThan(180);
    expect(decisionBox?.width ?? 999).toBeLessThanOrEqual(360);
    expect(heroCardBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((heroCardBox?.y ?? -1) + (heroCardBox?.height ?? 0)).toBeLessThanOrEqual(900);

    await cpuSeat.focus();
    await expect(cpuDetail).toBeVisible();
    await expect(cpuDetail.getByText(/Stack/i)).toBeVisible();
    await expect(cpuDetail.getByText(/^Bet$/i)).toBeVisible();
    await expect(cpuDetail.getByText("VPIP", { exact: true })).toBeVisible();
    const scopeSelector = cpuDetail.getByLabel("HUD game scope");
    await expect(scopeSelector).toBeVisible();
    await scopeSelector.selectOption("badugi");
    await expect(scopeSelector).toHaveValue("badugi");
    const detailBox = await cpuDetail.boundingBox();
    expect(detailBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect(detailBox?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((detailBox?.x ?? 0) + (detailBox?.width ?? 0)).toBeLessThanOrEqual(1440);
    expect((detailBox?.y ?? 0) + (detailBox?.height ?? 0)).toBeLessThanOrEqual(900);

    await page.getByRole("button", { name: /Cash Out/i }).click();
    await expect(page.getByRole("dialog", { name: /Cash out result/i })).toBeVisible();
    await expect(page.getByText(/Cash out stack/i)).toBeVisible();
    await page.getByRole("button", { name: /続行/i }).click();
    await expect(page.getByRole("dialog", { name: /Cash out result/i })).toBeHidden();

    await page.getByRole("button", { name: /設定|Settings/i }).click();
    await expect(page.getByTestId("game-utility-modal")).toBeVisible();
    await expect(page.getByTestId("game-utility-modal").getByText(/設定|Settings/i).first()).toBeVisible();
    await page.getByRole("button", { name: /閉じる|Close/i }).click();
    await expect(page.getByTestId("game-utility-modal")).toBeHidden();

    await page.getByRole("button", { name: /プロフィール|Profile/i }).click();
    await expect(page.getByTestId("game-utility-modal")).toBeVisible();
    await expect(page.getByTestId("game-utility-modal").getByText(/プロフィール|Profile/i).first()).toBeVisible();
    await page.getByRole("button", { name: /閉じる|Close/i }).click();
    await expect(page.getByTestId("game-utility-modal")).toBeHidden();

    await page.getByRole("button", { name: /履歴|History/i }).click();
    await expect(page.getByTestId("game-utility-modal")).toBeVisible();
    await expect(page.getByTestId("game-utility-modal").getByText(/履歴|History/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("game-utility-modal")).toBeHidden();
  });
});
