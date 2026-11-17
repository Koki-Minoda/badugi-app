import { expect, test } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { getProgressState, playOneHandProgression, waitForE2EDriver } from "./helpers/gameProgressHelper";
import { CORE5_VARIANTS, invokeTournamentHelper, startCore5Tournament } from "./helpers/core5LifecycleE2EHelper";

test.describe("cash result", () => {
  test.beforeEach(async ({ page }) => {
    await openAuthenticatedGame(page, `${APP_URL}?variant=nlh&mode=cash`);
    await waitForE2EDriver(page);
    const result = await playOneHandProgression(page, {
      maxSteps: 100, policy: "safe", requireHeroButtonClick: true,
    });
    expect(result.status).toBe("PASS");
  });

  test("starts a fresh cash hand without clicking Next", async ({ page }) => {
    const result = page.getByTestId("hand-result-overlay");
    const handId = await result.getAttribute("data-hand-id");
    expect(handId).toBeTruthy();
    await expect(page.getByTestId("hand-result-auto-next")).toBeVisible();
    await expect(result).toBeHidden({ timeout: 6000 });
    await expect.poll(async () => (await getProgressState(page)).isTerminal).toBe(false);
  });

  test("holds the settled hand while viewing history and lets the player continue", async ({ page }) => {
    const result = page.getByTestId("hand-result-overlay");
    const handId = await result.getAttribute("data-hand-id");
    expect(handId).toBeTruthy();
    await page.getByTestId("hand-result-history").click();
    const resume = page.getByTestId("hand-result-auto-next");
    await expect(resume).toHaveText(/Resume auto-next|自動進行を再開/);
    const history = page.getByTestId("game-utility-modal");
    await expect(history).toBeVisible();
    // Cross the original two-second deadline while the history is open.
    await page.waitForTimeout(2200);
    await expect(result).toHaveAttribute("data-hand-id", handId!);
    await expect(resume).toBeDisabled();
    await history.getByRole("button", { name: /^(閉じる|Close)$/ }).click();
    await expect(resume).toBeEnabled();
    await resume.click();
    await expect(result).toBeHidden({ timeout: 6000 });
  });
});

test("advances a settled tournament hand without the old five-second timer", async ({ page }) => {
  await startCore5Tournament(page, CORE5_VARIANTS.find(variant => variant.variant === "badugi")!);
  const first = await invokeTournamentHelper(page, "getStateSnapshot");
  await invokeTournamentHelper(page, "resolveHandNow");
  const result = page.getByTestId("hand-result-overlay");
  await expect(result).toBeVisible();
  await expect(page.getByTestId("hand-result-auto-next")).toBeEnabled();
  await expect.poll(async () => (await invokeTournamentHelper(page, "getStateSnapshot")).handId, {
    timeout: 4300,
  }).not.toBe(first.handId);
});
