import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  CORE5_VARIANTS,
  invokeTournamentHelper,
  returnTournamentOverlayToMenu,
  startCore5Tournament,
  writeLifecycleReport,
} from "./helpers/core5LifecycleE2EHelper";

const rows: any[] = [];
test.afterAll(() => writeLifecycleReport(path.resolve("reports/invariant/core5-tournament-loss-feedback.json"), rows));

test.describe("Core5 tournament loss feedback", () => {
  test.describe.configure({ timeout: 240000 });
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} hero bust feedback overlay is safe`, async ({ page }) => {
      await startCore5Tournament(page, variant);
      await invokeTournamentHelper(page, "forceHeroBust");
      const overlay = page.getByTestId("mtt-hero-bust-overlay");
      await expect(overlay).toBeVisible({ timeout: 20000 });
      await expect(overlay.getByTestId("mtt-hero-bust-hero-summary")).toBeVisible();
      await returnTournamentOverlayToMenu(page);
      rows.push({ variant: variant.variant, mode: "tournament", status: "PASS", feedbackSafe: true });
    });
  }
});

