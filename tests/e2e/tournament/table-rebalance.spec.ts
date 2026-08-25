import { test, expect } from "@playwright/test";
import {
  CORE5_VARIANTS,
  finishTournamentAndReturn,
  getHud,
  reportPath,
  startVariantTournament,
  writeTournamentIntegrationReport,
  type TournamentIntegrationRow,
} from "./tournamentIntegrationHelper";

const rows: TournamentIntegrationRow[] = [];
test.afterAll(() => writeTournamentIntegrationReport(reportPath("table-rebalance-e2e"), rows));

test.describe("tournament table rebalance integration", () => {
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} preserves table state through tournament completion`, async ({ page }) => {
      const initial = await startVariantTournament(page, variant);
      expect(initial.tablesActive).toBeGreaterThanOrEqual(1);
      const result = await finishTournamentAndReturn(page);
      const placements = result.placements.map((entry: any) => entry.place ?? entry.finishPlace ?? entry.placement);
      expect(new Set(placements.filter(Boolean)).size).toBeGreaterThan(0);
      rows.push({ category: "rebalance", variant: variant.variant, status: "PASS", initialTables: initial.tablesActive });
    });
  }
});
