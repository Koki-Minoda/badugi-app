import { test, expect } from "@playwright/test";
import {
  CORE5_VARIANTS,
  getHud,
  reportPath,
  startVariantTournament,
  writeTournamentIntegrationReport,
  type TournamentIntegrationRow,
} from "./tournamentIntegrationHelper";

const rows: TournamentIntegrationRow[] = [];
test.afterAll(() => writeTournamentIntegrationReport(reportPath("button-blind-assignment-e2e"), rows));

test.describe("tournament button and blind assignment integration", () => {
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} starts with valid tournament blind metadata`, async ({ page }) => {
      await startVariantTournament(page, variant);
      const hud = await getHud(page);
      expect(hud.playersRemaining).toBeGreaterThanOrEqual(2);
      expect(hud.heroSeatIndex).not.toBeNull();
      expect(hud.currentBlinds.bb).toBeGreaterThan(0);
      rows.push({ category: "button-blind", variant: variant.variant, status: "PASS", heroSeatIndex: hud.heroSeatIndex });
    });
  }
});
