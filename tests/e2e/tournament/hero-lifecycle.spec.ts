import { test, expect } from "@playwright/test";
import {
  CORE5_VARIANTS,
  finishTournamentAndReturn,
  reportPath,
  startVariantTournament,
  writeTournamentIntegrationReport,
  type TournamentIntegrationRow,
} from "./tournamentIntegrationHelper";

const rows: TournamentIntegrationRow[] = [];
test.afterAll(() => writeTournamentIntegrationReport(reportPath("hero-lifecycle-e2e"), rows));

test.describe("tournament hero lifecycle integration", () => {
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} preserves hero terminal/menu path`, async ({ page }) => {
      const hud = await startVariantTournament(page, variant);
      expect(hud.heroSeatIndex).not.toBeNull();
      const { placements } = await finishTournamentAndReturn(page);
      expect(placements.length).toBeGreaterThan(0);
      rows.push({ category: "hero-lifecycle", variant: variant.variant, status: "PASS", heroSeatIndex: hud.heroSeatIndex });
    });
  }
});
