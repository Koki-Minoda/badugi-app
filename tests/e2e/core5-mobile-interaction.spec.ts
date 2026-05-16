import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  CORE5_VARIANTS,
  captureFatalBrowserErrors,
  evaluateInitialLayout,
  evaluateMobileInteraction,
  evaluateResultFlow,
  launchCore5Variant,
  statusFor,
  writeAuditReport,
  type AuditIssue,
} from "./helpers/core5LayoutAuditHelper";

const REPORT_PATH = path.resolve("reports/alpha/core5-mobile-interaction-audit.json");
const VIEWPORTS = [
  { name: "portrait-390x844", width: 390, height: 844 },
  { name: "landscape-844x390", width: 844, height: 390 },
] as const;

test.describe("core five mobile interaction audit", () => {
  test.describe.configure({ timeout: 240000 });

  const rows: any[] = [];

  test.afterAll(() => {
    writeAuditReport(REPORT_PATH, rows);
  });

  for (const variant of CORE5_VARIANTS) {
    for (const viewport of VIEWPORTS) {
      test(`${variant.game} ${viewport.name} keeps tap targets and result controls reachable`, async ({ page }) => {
        const issues: AuditIssue[] = [];
        const browserErrors = captureFatalBrowserErrors(page);
        let metrics: Record<string, unknown> = {};

        try {
          await launchCore5Variant(page, variant, viewport);
          const initial = await evaluateInitialLayout(page, variant);
          const interaction = await evaluateMobileInteraction(page);
          const result = await evaluateResultFlow(page, variant);
          issues.push(...initial.issues, ...interaction.issues, ...result.issues);
          metrics = {
            initial: initial.metrics,
            interaction: interaction.metrics,
            result: result.metrics,
          };
        } catch (error) {
          issues.push({
            priority: "P0",
            issue: "mobile interaction audit threw",
            message: error instanceof Error ? error.message : String(error),
          });
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
        };
        rows.push(row);

        expect(row.variantId).toBe(variant.variant);
      });
    }
  }
});

