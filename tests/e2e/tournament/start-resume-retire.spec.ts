import { test, expect } from "@playwright/test";
import {
  CORE5_VARIANTS,
  reportPath,
  startVariantTournament,
  writeTournamentIntegrationReport,
  type TournamentIntegrationRow,
} from "./tournamentIntegrationHelper";

const rows: TournamentIntegrationRow[] = [];
test.afterAll(() => writeTournamentIntegrationReport(reportPath("start-resume-retire-e2e"), rows));

test.describe("tournament start resume retire integration", () => {
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} starts and can return through standard navigation`, async ({ page }) => {
      const hud = await startVariantTournament(page, variant);
      expect(hud.tournamentName).toMatch(/Core5 Lifecycle Gate/i);
      await page.getByRole("button", { name: /ゲーム選択|Game Select|Select Game/i }).first().click();
      await expect(page.getByText(/Select Your Variant|ゲームを選択/i)).toBeVisible({ timeout: 20000 });
      rows.push({ category: "start-resume-retire", variant: variant.variant, status: "PASS" });
    });
  }
});
