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
test.afterAll(() => writeTournamentIntegrationReport(reportPath("bust-placement-payout-e2e"), rows));

test.describe("tournament bust placement payout integration", () => {
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} produces placement and payout-safe terminal path`, async ({ page }) => {
      await startVariantTournament(page, variant);
      const { placements } = await finishTournamentAndReturn(page);
      expect(placements.length).toBeGreaterThan(0);
      const serialized = JSON.stringify(placements);
      expect(serialized).not.toMatch(/NaN|null payout mismatch/i);
      rows.push({ category: "bust-placement-payout", variant: variant.variant, status: "PASS", placements: placements.length });
    });
  }
});
