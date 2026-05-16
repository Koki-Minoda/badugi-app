import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  CORE5_VARIANTS,
  captureFatalBrowserErrors,
  evaluateInitialLayout,
  evaluateMobileInteraction,
  launchCore5Variant,
  saveScreenshot,
  statusFor,
  writeAuditReport,
  type AuditIssue,
} from "./helpers/core5LayoutAuditHelper";

const REPORT_PATH = path.resolve("reports/alpha/core5-mobile-portrait-layout-audit.json");
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
] as const;

test.describe("core five mobile portrait layout visual audit", () => {
  test.describe.configure({ timeout: 180000 });

  const rows: any[] = [];

  test.afterAll(() => {
    writeAuditReport(REPORT_PATH, rows);
  });

  for (const variant of CORE5_VARIANTS) {
    for (const viewport of VIEWPORTS) {
      test(`${variant.game} portrait ${viewport.name} keeps core controls and table visible`, async ({ page }) => {
        const issues: AuditIssue[] = [];
        const browserErrors = captureFatalBrowserErrors(page);
        let screenshotPath: string | null = null;
        let metrics: Record<string, unknown> = {};

        try {
          await launchCore5Variant(page, variant, viewport);
          const initial = await evaluateInitialLayout(page, variant);
          const interaction = await evaluateMobileInteraction(page);
          issues.push(...initial.issues, ...interaction.issues);
          metrics = { initial: initial.metrics, interaction: interaction.metrics };

          screenshotPath = await saveScreenshot(
            page,
            path.resolve(
              "reports/screenshots",
              `core5-mobile-portrait-${variant.variant.toLowerCase()}-${viewport.name}.png`,
            ),
          );
        } catch (error) {
          issues.push({
            priority: "P0",
            issue: "mobile portrait layout audit threw",
            message: error instanceof Error ? error.message : String(error),
          });
        }

        if (!screenshotPath) {
          screenshotPath = await saveScreenshot(
            page,
            path.resolve(
              "reports/screenshots",
              `core5-mobile-portrait-${variant.variant.toLowerCase()}-${viewport.name}-failure.png`,
            ),
          ).catch(() => null);
        }

        for (const message of browserErrors) {
          issues.push({ priority: "P0", issue: "browser fatal/error console", message });
        }

        const row = {
          game: variant.game,
          variantId: variant.variant,
          viewport: viewport.name,
          status: statusFor(issues),
          issues,
          metrics,
          screenshotPath,
        };
        rows.push(row);

        expect(row.variantId).toBe(variant.variant);
      });
    }
  }
});
