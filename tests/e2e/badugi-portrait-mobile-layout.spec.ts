import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  CORE5_VARIANTS,
  captureFatalBrowserErrors,
  evaluateInitialLayout,
  evaluateMobileInteraction,
  evaluateResultFlow,
  launchCore5Variant,
  saveScreenshot,
  statusFor,
  type AuditIssue,
} from "./helpers/core5LayoutAuditHelper";

const BADUGI = CORE5_VARIANTS.find((variant) => variant.variant === "badugi")!;
const REPORT_PATH = path.resolve("reports/alpha/badugi-portrait-mobile-layout-audit.json");
const VIEWPORTS = [
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
] as const;

test.describe("Badugi portrait mobile layout readiness", () => {
  test.describe.configure({ timeout: 240000 });

  const rows: any[] = [];

  test.afterAll(() => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    const statuses = rows.map((row) => row.status);
    fs.writeFileSync(
      REPORT_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          status: statuses.includes("FAIL") ? "FAIL" : statuses.includes("WARN") ? "WARN" : "PASS",
          rows,
        },
        null,
        2,
      )}\n`,
    );
  });

  for (const viewport of VIEWPORTS) {
    test(`Badugi portrait ${viewport.name} launches, plays, and keeps controls visible`, async ({ page }) => {
      const issues: AuditIssue[] = [];
      const browserErrors = captureFatalBrowserErrors(page);
      const screenshotPath = path.resolve("reports/screenshots", `badugi-portrait-mobile-${viewport.name}.png`);
      let metrics: Record<string, unknown> = {};

      try {
        await launchCore5Variant(page, BADUGI, viewport);
        const initial = await evaluateInitialLayout(page, BADUGI);
        const interaction = await evaluateMobileInteraction(page);
        issues.push(...initial.issues, ...interaction.issues);
        metrics = {
          initial: initial.metrics,
          interaction: interaction.metrics,
        };

        await saveScreenshot(page, screenshotPath);

        const result = await evaluateResultFlow(page, BADUGI);
        issues.push(...result.issues);
        metrics = {
          ...metrics,
          result: result.metrics,
        };

        await page.getByRole("button", { name: /next hand/i }).click();
        await expect(page.getByText("Hand Result").first()).toBeHidden({ timeout: 10000 });
        await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20000 });
      } catch (error) {
        issues.push({
          priority: "P0",
          issue: "Badugi portrait layout readiness threw",
          message: error instanceof Error ? error.message : String(error),
        });
        await saveScreenshot(page, screenshotPath).catch(() => {});
      }

      for (const message of browserErrors) {
        issues.push({ priority: "P0", issue: "browser fatal/error console", message });
      }

      const row = {
        game: BADUGI.game,
        variantId: BADUGI.variant,
        viewport: viewport.name,
        status: statusFor(issues),
        issues,
        metrics,
        screenshotPath,
      };
      rows.push(row);

      expect(row.status, JSON.stringify(row, null, 2)).toBe("PASS");
    });
  }
});
