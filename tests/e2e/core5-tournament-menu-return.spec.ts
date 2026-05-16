import path from "node:path";
import { test } from "@playwright/test";
import {
  CORE5_VARIANTS,
  fastForwardTournamentComplete,
  returnTournamentOverlayToMenu,
  startCore5Tournament,
  writeLifecycleReport,
} from "./helpers/core5LifecycleE2EHelper";

const rows: any[] = [];
test.afterAll(() => writeLifecycleReport(path.resolve("reports/invariant/core5-tournament-menu-return.json"), rows));

test.describe("Core5 tournament menu return", () => {
  test.describe.configure({ timeout: 300000 });
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} terminal tournament path returns to menu`, async ({ page }) => {
      await startCore5Tournament(page, variant);
      await fastForwardTournamentComplete(page);
      await returnTournamentOverlayToMenu(page);
      rows.push({ variant: variant.variant, mode: "tournament", status: "PASS", menuReturnSafe: true });
    });
  }
});

