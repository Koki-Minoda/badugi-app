import path from "node:path";
import { test, expect } from "@playwright/test";
import { CORE5_VARIANTS, openCore5Cash, playCashHand, writeLifecycleReport } from "./helpers/core5LifecycleE2EHelper";

const rows: any[] = [];
test.afterAll(() => writeLifecycleReport(path.resolve("reports/invariant/core5-cash-feedback-lifecycle.json"), rows));

test.describe("Core5 cash feedback lifecycle", () => {
  test.describe.configure({ timeout: 240000 });
  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} cash feedback path is safe or explicitly absent`, async ({ page }) => {
      await openCore5Cash(page, variant);
      await playCashHand(page, variant);
      const fatalPanels = await page.locator("text=/undefined|null|NaN/").count();
      expect(fatalPanels).toBe(0);
      rows.push({ variant: variant.variant, mode: "cash", status: "PASS", feedbackSafe: true });
    });
  }
});

