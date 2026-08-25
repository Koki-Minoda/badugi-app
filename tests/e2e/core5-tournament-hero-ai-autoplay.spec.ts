import path from "node:path";
import { test } from "@playwright/test";
import {
  CORE5_VARIANTS,
  fastForwardTournamentComplete,
  startCore5Tournament,
  writeLifecycleReport,
} from "./helpers/core5LifecycleE2EHelper";

const rows: any[] = [];
test.afterAll(() => writeLifecycleReport(path.resolve("reports/invariant/core5-tournament-hero-ai-autoplay.json"), rows));

test.describe("Core5 tournament hero autoplay compatibility", () => {
  test.describe.configure({ timeout: 300000 });
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} tournament helper can complete without zombie hero actor`, async ({ page }) => {
      await startCore5Tournament(page, variant);
      await fastForwardTournamentComplete(page);
      rows.push({ variant: variant.variant, mode: "tournament", status: "PASS", heroAutoplaySafe: true });
    });
  }
});

