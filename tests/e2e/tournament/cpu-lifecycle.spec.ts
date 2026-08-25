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
test.afterAll(() => writeTournamentIntegrationReport(reportPath("cpu-lifecycle-e2e"), rows));

test.describe("tournament CPU lifecycle integration", () => {
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} CPU simulation reaches terminal overlay safely`, async ({ page }) => {
      await startVariantTournament(page, variant);
      const { placements } = await finishTournamentAndReturn(page);
      expect(placements.some((entry: any) => /cpu/i.test(JSON.stringify(entry)))).toBe(true);
      rows.push({ category: "cpu-lifecycle", variant: variant.variant, status: "PASS" });
    });
  }
});
