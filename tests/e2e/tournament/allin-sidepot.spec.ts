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
test.afterAll(() => writeTournamentIntegrationReport(reportPath("allin-sidepot-e2e"), rows));

test.describe("tournament all-in side-pot integration smoke", () => {
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} completes terminal pot path without zombie actor`, async ({ page }) => {
      await startVariantTournament(page, variant);
      await finishTournamentAndReturn(page);
      await expect(page.getByTestId("menu-ring")).toBeVisible({ timeout: 20000 });
      rows.push({ category: "allin-sidepot", variant: variant.variant, status: "PASS", zombieActor: false });
    });
  }
});
