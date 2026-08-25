import path from "node:path";
import { test } from "@playwright/test";
import { CORE5_VARIANTS, cashOutToSelector, openCore5Cash, playCashHand, writeLifecycleReport } from "./helpers/core5LifecycleE2EHelper";

const rows: any[] = [];
test.afterAll(() => writeLifecycleReport(path.resolve("reports/invariant/core5-cash-full-lifecycle-gate.json"), rows));

test.describe("Core5 cash full lifecycle gate", () => {
  test.describe.configure({ timeout: 360000 });
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} cash full lifecycle`, async ({ page }) => {
      await openCore5Cash(page, variant);
      await playCashHand(page, variant);
      await cashOutToSelector(page);
      rows.push({ variant: variant.variant, mode: "cash", status: "PASS", handsCompleted: 1, cashOutReturnedToMenu: true });
    });
  }
});

