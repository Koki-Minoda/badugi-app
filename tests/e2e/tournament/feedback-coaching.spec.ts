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
test.afterAll(() => writeTournamentIntegrationReport(reportPath("feedback-coaching-e2e"), rows));

test.describe("tournament feedback coaching integration", () => {
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} terminal replay/feedback path is safe`, async ({ page }) => {
      await startVariantTournament(page, variant);
      const { replay } = await finishTournamentAndReturn(page);
      expect(replay === null || typeof replay === "object").toBe(true);
      rows.push({ category: "feedback-coaching", variant: variant.variant, status: "PASS", replaySafe: true });
    });
  }
});
