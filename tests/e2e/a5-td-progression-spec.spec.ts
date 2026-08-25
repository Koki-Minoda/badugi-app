import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import {
  getProgressState,
  playOneHandProgression,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

async function visibleTotalPot(page: Page) {
  return page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    const match = text.match(/Total Pot\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  });
}

test.describe("A-5 Triple Draw progression spec", () => {
  test.describe.configure({ timeout: 180000 });

  test("D02 reaches hand result through exactly three draw rounds", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("mgx.previewVariants", "true");
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page, `${APP_URL}?variant=D02`);
    await waitForE2EDriver(page);

    await expect(page.getByText(/A-5 Triple Draw/i).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });

    const initial = await getProgressState(page);
    const variantText = [
      initial.state?.controllerName,
      initial.state?.gameVariant?.id,
      initial.state?.gameVariant?.variantId,
      initial.state?.gameVariant?.label,
      initial.state?.gameVariant?.name,
    ]
      .filter(Boolean)
      .join(" ");
    expect(variantText).toMatch(/AceToFiveTripleDraw|D02|A-5 Triple Draw/i);
    const initialPot = await visibleTotalPot(page);
    expect(initialPot).not.toBeNull();
    expect(initialPot ?? 0).toBeGreaterThan(0);

    const result = await playOneHandProgression(page, {
      maxSteps: 110,
      policy: "safe",
      requireHeroButtonClick: true,
      requireDrawVisit: true,
    });

    expect(result.status).toBe("PASS");
    expect(result.visitedDrawRounds).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(result.visitedDrawRounds).not.toContain(4);
    await expect(page.getByText("Hand Result").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 10000 });
  });
});
