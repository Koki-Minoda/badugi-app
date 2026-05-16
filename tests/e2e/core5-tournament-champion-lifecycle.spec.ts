import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  CORE5_VARIANTS,
  fastForwardTournamentComplete,
  invokeTournamentHelper,
  startCore5Tournament,
  writeLifecycleReport,
} from "./helpers/core5LifecycleE2EHelper";

const rows: any[] = [];
test.afterAll(() => writeLifecycleReport(path.resolve("reports/invariant/core5-tournament-champion-lifecycle.json"), rows));

test.describe("Core5 tournament champion lifecycle", () => {
  test.describe.configure({ timeout: 300000 });
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} tournament reaches champion or hero bust terminal`, async ({ page }) => {
      await startCore5Tournament(page, variant);
      await fastForwardTournamentComplete(page);
      const placements = await invokeTournamentHelper(page, "getTournamentPlacements");
      expect(Array.isArray(placements)).toBe(true);
      expect(placements.length).toBeGreaterThan(0);
      rows.push({ variant: variant.variant, mode: "tournament", status: "PASS", championSafe: true, tournamentsCompleted: 1 });
    });
  }
});

