import { test, expect, type Page } from "@playwright/test";
import { openAuthenticatedGame } from "./authHelper";
import {
  expectMobileActionsInViewport,
  playOneHandProgression,
  waitForE2EDriver,
} from "./helpers/gameProgressHelper.js";

const VIEWPORTS = [
  { name: "portrait-390", width: 390, height: 844 },
  { name: "portrait-430", width: 430, height: 932 },
  { name: "landscape-844", width: 844, height: 390 },
] as const;

function captureFatalBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (!/favicon|ResizeObserver loop|Failed to load resource: the server responded with a status of 404/i.test(text)) {
      errors.push(text);
    }
  });
  return errors;
}

async function openBadugiPreview(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page);
  await waitForE2EDriver(page);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(
      async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      { timeout: 10000 },
    )
    .toBeLessThanOrEqual(2);
}

async function expectPotPhaseAndControls(page: Page) {
  await expect(page.getByText(/Total Pot/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Phase/i).first()).toBeVisible({ timeout: 10000 });
  await expectMobileActionsInViewport(page);
  await expectNoHorizontalOverflow(page);
}

test.describe("Badugi mobile gameplay layout", () => {
  test.describe.configure({ timeout: 240000 });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} keeps table, controls, pot, phase, and result flow usable`, async ({ page }) => {
      test.fail(
        viewport.name !== "landscape-844",
        "Known Badugi alpha-restore blocker: portrait mobile preview launch is not consistently ready.",
      );

      const browserErrors = captureFatalBrowserErrors(page);

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openBadugiPreview(page);
      await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
      await expectPotPhaseAndControls(page);

      const result = await playOneHandProgression(page, {
        maxSteps: 110,
        policy: "safe",
        requireHeroButtonClick: true,
        requireDrawVisit: true,
      });

      expect(result.status).toBe("PASS");
      expect(result.visitedPhases).toContain("DRAW");
      await expect(page.getByText("Hand Result").first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 10000 });
      await expectNoHorizontalOverflow(page);

      await page.getByRole("button", { name: /next hand/i }).click();
      await expect(page.getByText("Hand Result").first()).toBeHidden({ timeout: 10000 });
      await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
      await expectPotPhaseAndControls(page);

      expect(browserErrors).toEqual([]);
    });
  }
});
