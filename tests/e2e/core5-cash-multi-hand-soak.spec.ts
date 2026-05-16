import path from "node:path";
import { test, expect } from "@playwright/test";
import { CORE5_VARIANTS, openCore5Cash, playCashHand, writeLifecycleReport } from "./helpers/core5LifecycleE2EHelper";

const rows: any[] = [];
test.afterAll(() => writeLifecycleReport(path.resolve("reports/invariant/core5-cash-multi-hand-soak.json"), rows));

test.describe("Core5 cash multi-hand soak", () => {
  test.describe.configure({ timeout: 300000 });
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} starts a clean next cash hand`, async ({ page }) => {
      await openCore5Cash(page, variant);
      await playCashHand(page, variant);
      const dealt = await page.evaluate(() => window.__BADUGI_E2E__?.dealNewHandNow?.() ?? false);
      expect(dealt).toBeTruthy();
      rows.push({ variant: variant.variant, mode: "cash", status: "PASS", handsCompleted: 2, nextHandStarted: true });
    });
  }
});

