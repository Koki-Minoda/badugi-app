import { test, expect, type Page } from "@playwright/test";
import { openAuthenticatedGame } from "./authHelper";
import {
  getProgressState,
  playOneHandProgression,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

async function openBadugiPreview(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page);
  await waitForE2EDriver(page);
}

async function visibleTotalPot(page: Page) {
  return page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    const match = text.match(/Total Pot\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  });
}

test.describe("Badugi progression release spec", () => {
  test.describe.configure({ timeout: 160000 });

  test("reaches hand result with nonzero active pot and no stale hero acting", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openBadugiPreview(page);

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
    expect(result.visitedPhases).toContain("BET");
    expect(result.visitedPhases).toContain("DRAW");
    expect(result.visitedDrawRounds.length).toBeGreaterThanOrEqual(1);
    await expect(page.getByText("Hand Result").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 10000 });

    const state = await getProgressState(page);
    expect(state.isTerminal).toBe(true);
  });
});
