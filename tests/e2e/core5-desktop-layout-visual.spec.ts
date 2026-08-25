import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  CORE5_VARIANTS,
  captureFatalBrowserErrors,
  evaluateInitialLayout,
  evaluateResultFlow,
  launchCore5Variant,
  saveScreenshot,
  statusFor,
  writeAuditReport,
  type AuditIssue,
} from "./helpers/core5LayoutAuditHelper";

const REPORT_PATH = path.resolve("reports/alpha/core5-desktop-layout-audit.json");
const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900, exerciseResult: true },
  { name: "1280x720", width: 1280, height: 720, exerciseResult: false },
] as const;

test.describe("core five desktop layout visual audit", () => {
  test.describe.configure({ timeout: 240000 });

  const rows: any[] = [];

  test.afterAll(() => {
    writeAuditReport(REPORT_PATH, rows);
  });

  for (const variant of CORE5_VARIANTS) {
    for (const viewport of VIEWPORTS) {
      test(`${variant.game} ${viewport.name} exposes table, pot, phase, actions, and result path`, async ({ page }) => {
        const issues: AuditIssue[] = [];
        const browserErrors = captureFatalBrowserErrors(page);
        let screenshotPath: string | null = null;
        let metrics: Record<string, unknown> = {};

        try {
          await launchCore5Variant(page, variant, viewport);
          const initial = await evaluateInitialLayout(page, variant);
          issues.push(...initial.issues);
          metrics = { ...metrics, initial: initial.metrics };

          if (viewport.exerciseResult) {
            const result = await evaluateResultFlow(page, variant);
            issues.push(...result.issues);
            metrics = { ...metrics, result: result.metrics };
          }

          screenshotPath = await saveScreenshot(
            page,
            path.resolve("reports/screenshots", `core5-desktop-${variant.variant.toLowerCase()}-${viewport.name}.png`),
          );
        } catch (error) {
          issues.push({
            priority: "P0",
            issue: "desktop layout audit threw",
            message: error instanceof Error ? error.message : String(error),
          });
        }

        if (!screenshotPath) {
          screenshotPath = await saveScreenshot(
            page,
            path.resolve("reports/screenshots", `core5-desktop-${variant.variant.toLowerCase()}-${viewport.name}-failure.png`),
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
