import { test, expect, type Page } from "@playwright/test";
import { openAuthenticatedGame } from "./authHelper";

async function waitForE2EHelper(page: Page, helperName: string) {
  await page.waitForFunction(
    (method) => typeof window.__BADUGI_E2E__?.[method] === "function",
    helperName,
    { timeout: 30000 },
  );
}

async function invokeE2E(page: Page, method: string, ...args: unknown[]) {
  return page.evaluate(
    async ({ methodName, params }) => {
      const api = window.__BADUGI_E2E__;
      if (!api || typeof api[methodName] !== "function") {
        throw new Error(`E2E helper ${methodName} is not available`);
      }
      return await api[methodName](...params);
    },
    { methodName: method, params: args },
  );
}

test.describe("tournament UI layout smoke", () => {
  test.describe.configure({ timeout: 90000 });

  test("keeps compact MTT HUD and table seats usable without vertical scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page);
    await waitForE2EHelper(page, "startTournamentMTT");
    await invokeE2E(page, "startTournamentMTT");

    const hud = page.getByTestId("tournament-hud");
    const heroCard = page.locator('[data-testid="player-0-card-0"]:visible').first();
    const topSeat = page.getByTestId("seat-3");
    const rightTopSeat = page.getByTestId("seat-4");
    const rightBottomSeat = page.getByTestId("seat-5");
    const rightTopDetail = page.getByTestId("seat-4-detail");
    const heroAvatar = page.getByTestId("seat-0-avatar");
    const heroPosition = page.getByTestId("seat-0-pos");

    await expect(hud).toBeVisible();
    await expect(heroCard).toBeVisible();
    await expect(topSeat).toBeVisible();
    await expect(rightTopSeat).toBeVisible();
    await expect(rightBottomSeat).toBeVisible();

    const [hudBox, heroCardBox, rightTopBox, rightBottomBox] = await Promise.all([
      hud.boundingBox(),
      heroCard.boundingBox(),
      rightTopSeat.boundingBox(),
      rightBottomSeat.boundingBox(),
    ]);

    expect(hudBox?.height ?? 999).toBeLessThanOrEqual(360);
    expect(hudBox?.x ?? 0).toBeGreaterThanOrEqual(1100);
    expect(heroCardBox?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((heroCardBox?.y ?? 0) + (heroCardBox?.height ?? 0)).toBeLessThanOrEqual(900);

    const rightTopBottom = (rightTopBox?.y ?? 0) + (rightTopBox?.height ?? 0);
    expect(rightTopBottom).toBeLessThan((rightBottomBox?.y ?? 0) + 10);

    const [heroAvatarBox, heroPositionBox] = await Promise.all([
      heroAvatar.boundingBox(),
      heroPosition.boundingBox(),
    ]);
    const avatarRight = (heroAvatarBox?.x ?? 0) + (heroAvatarBox?.width ?? 0);
    expect(avatarRight).toBeLessThanOrEqual((heroPositionBox?.x ?? 0) + 2);

    await rightTopSeat.focus();
    await expect(rightTopDetail).toBeVisible();
    const [rightTopDetailBox, focusedRightTopBox, focusedRightBottomBox] = await Promise.all([
      rightTopDetail.boundingBox(),
      rightTopSeat.boundingBox(),
      rightBottomSeat.boundingBox(),
    ]);
    expect((rightTopDetailBox?.y ?? 999)).toBeLessThanOrEqual((focusedRightTopBox?.y ?? 0) + 2);
    expect((rightTopDetailBox?.y ?? 0) + (rightTopDetailBox?.height ?? 0)).toBeLessThan(
      (focusedRightBottomBox?.y ?? 0),
    );

    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(scrollHeight).toBeLessThanOrEqual(viewportHeight + 8);
  });
});
