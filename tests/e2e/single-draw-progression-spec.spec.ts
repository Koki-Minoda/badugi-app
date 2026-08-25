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

const variants = [
  {
    id: "S01",
    heading: /2-7 Single Draw/i,
    identity: /DeuceToSevenSingleDraw|S01|2-7 Single Draw/i,
  },
  {
    id: "S02",
    heading: /A-5 Single Draw/i,
    identity: /AceToFiveSingleDraw|S02|A-5 Single Draw/i,
  },
];

test.describe("Single Draw progression spec", () => {
  test.describe.configure({ timeout: 180000 });

  for (const variant of variants) {
    test(`${variant.id} reaches hand result through exactly one draw round`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant.id}`);
      await waitForE2EDriver(page);

      await expect(page.getByText(variant.heading).first()).toBeVisible({ timeout: 20000 });
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
      expect(variantText).toMatch(variant.identity);

      const initialPot = await visibleTotalPot(page);
      expect(initialPot).not.toBeNull();
      expect(initialPot ?? 0).toBeGreaterThan(0);

      const result = await playOneHandProgression(page, {
        maxSteps: 70,
        policy: "safe",
        requireHeroButtonClick: true,
        requireDrawVisit: true,
      });

      expect(result.status).toBe("PASS");
      expect(result.visitedDrawRounds).toEqual(expect.arrayContaining([1]));
      expect(result.visitedDrawRounds).not.toContain(2);
      expect(result.visitedDrawRounds).not.toContain(3);
      await expect(page.getByText("Hand Result").first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 10000 });
    });
  }
});
