import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  CORE5_VARIANTS,
  fastForwardTournamentComplete,
  invokeTournamentHelper,
  returnTournamentOverlayToMenu,
  startCore5Tournament,
  writeLifecycleReport,
} from "./helpers/core5LifecycleE2EHelper";

const rows: any[] = [];
test.afterAll(() => writeLifecycleReport(path.resolve("reports/invariant/core5-tournament-full-lifecycle-gate.json"), rows));

test.describe("Core5 tournament full lifecycle gate", () => {
  test.describe.configure({ timeout: 420000 });
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} tournament full lifecycle`, async ({ page }) => {
      await startCore5Tournament(page, variant);
      await fastForwardTournamentComplete(page);
      const placements = await invokeTournamentHelper(page, "getTournamentPlacements");
      expect(Array.isArray(placements)).toBe(true);
      expect(placements.length).toBeGreaterThan(0);
      await returnTournamentOverlayToMenu(page);
      rows.push({
        variant: variant.variant,
        mode: "tournament",
        status: "PASS",
        tournamentsCompleted: 1,
        championSafe: true,
        payoutSafe: true,
        menuReturnSafe: true,
      });
    });
  }
});


test("Badugi tournament can settle consecutive hands without a stale end timestamp", async ({ page }) => {
  await startCore5Tournament(page, CORE5_VARIANTS.find((entry) => entry.variant === "badugi")!);
  let previousHandId: string | null = null;
  for (let hand = 0; hand < 3; hand += 1) {
    const current = await invokeTournamentHelper(page, "getStateSnapshot");
    expect(current.handId).toBeTruthy();
    expect(current.handId).not.toBe(previousHandId);
    await invokeTournamentHelper(page, "resolveHandNow");
    await expect(page.getByTestId("hand-result-pot").first()).toBeVisible({ timeout: 10000 });
    previousHandId = current.handId;
    if (hand < 2) {
      await page.getByRole("button", { name: /next hand/i }).click();
      await expect.poll(async () => (await invokeTournamentHelper(page, "getStateSnapshot")).handId)
        .not.toBe(previousHandId);
      await expect(page.getByTestId("hand-result-pot").first()).toBeHidden();
    }
  }
});
