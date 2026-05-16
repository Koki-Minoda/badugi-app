import path from "node:path";
import { test } from "@playwright/test";
import { CORE5_VARIANTS, cashOutToSelector, openCore5Cash, writeLifecycleReport } from "./helpers/core5LifecycleE2EHelper";

const rows: any[] = [];
test.afterAll(() => writeLifecycleReport(path.resolve("reports/invariant/core5-cash-out-menu-return.json"), rows));

test.describe("Core5 cash out menu return", () => {
  test.describe.configure({ timeout: 180000 });
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} cashes out to selector`, async ({ page }) => {
      await openCore5Cash(page, variant);
      await cashOutToSelector(page);
      rows.push({ variant: variant.variant, mode: "cash", status: "PASS", cashOutReturnedToMenu: true });
    });
  }
});

