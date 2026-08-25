import path from "node:path";
import { test } from "@playwright/test";
import { CORE5_VARIANTS, openCore5Cash, playCashHand, writeLifecycleReport } from "./helpers/core5LifecycleE2EHelper";

const rows: any[] = [];
test.afterAll(() => writeLifecycleReport(path.resolve("reports/invariant/core5-cash-hero-ai-autoplay.json"), rows));

test.describe("Core5 cash hero autoplay compatibility", () => {
  test.describe.configure({ timeout: 240000 });
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} controller-assisted hero path stays consistent`, async ({ page }) => {
      await openCore5Cash(page, variant);
      await playCashHand(page, variant);
      rows.push({ variant: variant.variant, mode: "cash", status: "PASS", heroAutoplaySafe: true });
    });
  }
});

