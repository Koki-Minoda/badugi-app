import { test, expect } from "@playwright/test";
import {
  CORE5_VARIANTS,
  collectHudBoxes,
  expectTournamentHudVisible,
  reportPath,
  startVariantTournament,
  writeTournamentIntegrationReport,
  type TournamentIntegrationRow,
} from "./tournamentIntegrationHelper";

const rows: TournamentIntegrationRow[] = [];
test.afterAll(() => writeTournamentIntegrationReport(reportPath("tournament-hud-ui-e2e"), rows));

test.describe("tournament HUD UI integration", () => {
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} HUD and gameplay controls are visible`, async ({ page }) => {
      await startVariantTournament(page, variant);
      await expectTournamentHudVisible(page);
      const boxes = await collectHudBoxes(page);
      expect(boxes.hud).toBeTruthy();
      expect(boxes.decisionPanel).toBeTruthy();
      expect(boxes.table).toBeTruthy();
      rows.push({ category: "hud-mobile", variant: variant.variant, status: "PASS", boxes });
    });
  }
});
