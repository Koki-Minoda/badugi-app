import path from "node:path";
import { test, expect } from "@playwright/test";
import { CORE5_VARIANTS, captureFatalBrowserErrors, type AuditIssue } from "./helpers/core5LayoutAuditHelper";
import {
  LIVE_LAYOUT_VIEWPORTS,
  closeLiveContext,
  evaluateLiveGameplayLayout,
  openLiveGame,
  openLiveMobileContext,
  openLiveTournament,
  saveLiveScreenshot,
  writeLiveReport,
} from "./helpers/liveCore5Helper";

const REPORT_PATH = path.resolve("reports/alpha/live-core5-layout-evidence-v2.json");

const LAYOUT_CASES = LIVE_LAYOUT_VIEWPORTS.flatMap((viewport) => [
  { mode: "cash" as const, viewport },
  { mode: "tournament" as const, viewport },
]);

test.describe("Live Core5 layout evidence v2", () => {
  test.describe.configure({ timeout: 900000 });

  const rows: any[] = [];

  test.afterAll(() => {
    writeLiveReport(REPORT_PATH, rows, { liveUrl: "https://mgx-poker.com/" });
    const failingRows = rows.filter((row) => row.status === "FAIL");
    expect(failingRows, JSON.stringify(failingRows, null, 2)).toHaveLength(0);
  });

  for (const variant of CORE5_VARIANTS) {
    for (const layoutCase of LAYOUT_CASES) {
      test(`${variant.game} ${layoutCase.mode} ${layoutCase.viewport.name} live evidence`, async ({ browser }) => {
        const { context, page } = await openLiveMobileContext(browser, layoutCase.viewport);
        const browserErrors = captureFatalBrowserErrors(page);
        const issues: AuditIssue[] = [];
        let metrics: Record<string, unknown> = {};
        let screenshotPath: string | null = null;

        try {
          if (layoutCase.mode === "tournament") {
            await openLiveTournament(page, variant);
          } else {
            await openLiveGame(page, variant);
          }
          const result = await evaluateLiveGameplayLayout(page, variant, layoutCase.viewport, layoutCase.mode);
          issues.push(...result.issues);
          metrics = result.metrics;
          screenshotPath = await saveLiveScreenshot({
            page,
            prefix: "live-core5-v2",
            variant,
            viewport: layoutCase.viewport,
            mode: layoutCase.mode,
          });
        } catch (error) {
          issues.push({
            priority: "P0",
            issue: "LIVE_LAYOUT_AUDIT_THROW",
            message: error instanceof Error ? error.message : String(error),
          });
          screenshotPath = await saveLiveScreenshot({
            page,
            prefix: "live-core5-v2-failure",
            variant,
            viewport: layoutCase.viewport,
            mode: layoutCase.mode,
          }).catch(() => null);
        } finally {
          await closeLiveContext(context);
        }

        for (const message of browserErrors) {
          if (/favicon|ResizeObserver loop|Failed to load resource/i.test(message)) continue;
          issues.push({ priority: "P0", issue: "browser fatal/error console", message });
        }

        rows.push({
          game: variant.game,
          variantId: variant.variant,
          mode: layoutCase.mode,
          viewport: layoutCase.viewport.name,
          orientation: layoutCase.viewport.orientation,
          status: issues.some((issue) => issue.priority === "P0") ? "FAIL" : "PASS",
          issues,
          metrics,
          screenshotPath,
        });
      });
    }
  }
});
