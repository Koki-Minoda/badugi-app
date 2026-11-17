import { expect, test } from "@playwright/test";
import { APP_URL, deleteAuthenticatedSession, openAuthenticatedGame } from "./authHelper";
import { getProgressState, invokeE2E, playOneHandProgression, waitForE2EDriver } from "./helpers/gameProgressHelper";

test("cash-out New Table starts a new PLO hand on the same screen and variant", async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => localStorage.setItem("mgx.handResult.autoNext", "off"));
  const session = await openAuthenticatedGame(page, `${APP_URL}?variant=plo&mode=cash`);
  try {
    await waitForE2EDriver(page);
    const result = page.getByTestId("hand-result-overlay");
    const snapshot = () => invokeE2E(page, "getStateSnapshot");
    await invokeE2E(page, "resolveHandNow");
    await expect(result).toBeVisible();
    await page.getByTestId("hand-result-next-hand").click();
    await expect.poll(async () => (await snapshot()).handCount).toBe(2);
    await invokeE2E(page, "resolveHandNow");
    await expect(result).toBeVisible();
    const previous = await result.getAttribute("data-hand-id");
    expect(previous).toBeTruthy();
    await page.getByTestId("hand-result-cash-out").click();
    const cashOut = page.getByRole("dialog", { name: "Cash out result" });
    await expect(cashOut.getByTestId("cash-out-hands")).toHaveText("2");
    await cashOut.getByRole("button", {name:"新しい卓",exact:true}).click();
    await expect.poll(async () => (await snapshot()).handCount).toBe(1);
    await expect(result).toBeHidden();
    const next = await snapshot();
    expect(next.gameVariant).toBe("plo");
    expect(next.handId).toBeTruthy();
    expect(next.handId).not.toBe(previous);
    expect(next.players[0]?.stack).toBeGreaterThan(0);
    expect((await getProgressState(page)).isTerminal).toBe(false);
    const played = await playOneHandProgression(page, { maxSteps: 80, autoCpu: true, requireHeroButtonClick: true });
    expect(played.status).toBe("PASS");
  } finally {
    await deleteAuthenticatedSession(page, session);
  }
});
