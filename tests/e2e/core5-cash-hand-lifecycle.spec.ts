import path from "node:path";
import { test } from "@playwright/test";
import { CORE5_VARIANTS, openCore5Cash, playCashHand, writeLifecycleReport } from "./helpers/core5LifecycleE2EHelper";

const rows: any[] = [];
test.afterAll(() => writeLifecycleReport(path.resolve("reports/invariant/core5-cash-hand-lifecycle.json"), rows));

test.describe("Core5 cash hand lifecycle", () => {
  test.describe.configure({ timeout: 240000 });
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} completes a cash hand`, async ({ page }) => {
      await openCore5Cash(page, variant);
      const result = await playCashHand(page, variant);
      rows.push({ variant: variant.variant, mode: "cash", status: "PASS", handsCompleted: 1, steps: result.steps });
    });
  }
});

