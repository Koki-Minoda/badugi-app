import path from "node:path";
import { test, expect } from "@playwright/test";
import { CORE5_VARIANTS, captureFatalBrowserErrors, type AuditIssue } from "./helpers/core5LayoutAuditHelper";
import {
  TOURNAMENT_VIEWPORTS,
  closeContext,
  evaluateTournamentMobileLayout,
  openCore5Tournament,
  openMobileTournamentContext,
  saveTournamentScreenshot,
  writeTournamentAuditReport,
} from "./helpers/core5TournamentLayoutHelper";

const REPORT_PATH = path.resolve("reports/alpha/core5-mobile-tournament-portrait-layout.json");
const PORTRAIT_VIEWPORTS = TOURNAMENT_VIEWPORTS.filter((viewport) => viewport.orientation === "portrait");

test.describe("Core 5 mobile tournament portrait layout", () => {
  test.describe.configure({ timeout: 240000 });

  const rows: any[] = [];

  test.afterAll(() => {
    writeTournamentAuditReport(REPORT_PATH, rows);
  });

  for (const variant of CORE5_VARIANTS) {
    for (const viewport of PORTRAIT_VIEWPORTS) {
      test(`${variant.game} tournament portrait ${viewport.name} keeps HUD compact and controls visible`, async ({ browser }) => {
        const { context, page } = await openMobileTournamentContext(browser, viewport);
        const browserErrors = captureFatalBrowserErrors(page);
        const issues: AuditIssue[] = [];
        let screenshotPath: string | null = null;
        let metrics: Record<string, unknown> = {};

        try {
          await openCore5Tournament(page, variant);
          const result = await evaluateTournamentMobileLayout(page, variant, viewport);
          issues.push(...result.issues);
          metrics = result.metrics;
          screenshotPath = await saveTournamentScreenshot({
            page,
            prefix: "core5-mobile-tournament-portrait",
            variant,
            viewport,
          });
        } catch (error) {
          issues.push({
            priority: "P0",
            issue: "tournament portrait layout audit threw",
            message: error instanceof Error ? error.message : String(error),
          });
        } finally {
          await closeContext(context);
        }

        for (const message of browserErrors) {
          if (/controller\.applyPlayerAction|legacyGameController\.startNewHand/.test(message)) continue;
          issues.push({ priority: "P0", issue: "browser fatal/error console", message });
        }

        const row = {
          game: variant.game,
          variantId: variant.variant,
          viewport: viewport.name,
          status: issues.some((issue) => issue.priority === "P0")
            ? "FAIL"
            : issues.some((issue) => issue.priority === "P1")
              ? "WARN"
              : "PASS",
          issues,
          metrics,
          screenshotPath,
        };
        rows.push(row);

        expect(row.status, JSON.stringify(row, null, 2)).toBe("PASS");
      });
    }
  }
});
