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
test.afterAll(() => writeTournamentIntegrationReport(reportPath("blind-level-progression-e2e"), rows));

test.describe("tournament blind level progression integration", () => {
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} exposes current and next blind levels`, async ({ page }) => {
      const hud = await startVariantTournament(page, variant);
      expect(hud.currentLevelNumber).toBe(1);
      expect(hud.currentBlinds.sb).toBeGreaterThan(0);
      expect(hud.currentBlinds.bb).toBeGreaterThan(hud.currentBlinds.sb);
      expect(hud.nextLevelBlinds?.bb ?? hud.currentBlinds.bb).toBeGreaterThanOrEqual(hud.currentBlinds.bb);
      const secondRead = await getHud(page);
      expect(secondRead.currentBlinds.bb).toBe(hud.currentBlinds.bb);
      rows.push({ category: "blind-level", variant: variant.variant, status: "PASS", currentBlinds: hud.currentBlinds });
    });
  }
});
