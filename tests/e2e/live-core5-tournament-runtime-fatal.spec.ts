import path from "node:path";
import { test, expect } from "@playwright/test";
import { CORE5_VARIANTS, captureFatalBrowserErrors } from "./helpers/core5LayoutAuditHelper";
import { openLiveTournament, writeLiveReport } from "./helpers/liveCore5Helper";
import { getProgressState, performSafeAction, progressKey, waitForProgressChange } from "./helpers/gameProgressHelper.js";

const REPORT_PATH = path.resolve("reports/alpha/live-core5-tournament-runtime-fatal.json");

const rows: any[] = [];

test.describe("Live Core5 tournament runtime fatal regression", () => {
  test.describe.configure({ timeout: 420000 });

  test.afterAll(() => {
    writeLiveReport(REPORT_PATH, rows, { liveUrl: "https://mgx-poker.com/" });
    expect(rows.filter((row) => row.status === "FAIL"), JSON.stringify(rows, null, 2)).toEqual([]);
  });

  for (const variant of CORE5_VARIANTS) {
    test(`${variant.game} tournament launches without browser fatal`, async ({ page }) => {
      const browserErrors = captureFatalBrowserErrors(page);
      const issues: string[] = [];
      let actionBeforeCrash: any = null;

      try {
        await openLiveTournament(page, variant);
        const progress = await getProgressState(page);
        actionBeforeCrash = {
          phase: progress.phase,
          actor: progress.actor,
          drawRound: progress.drawRoundIndex,
          handId: progress.handId,
        };
        const beforeKey = progressKey(progress);
        const acted = await performSafeAction(page, { policy: "safe" });
        expect(acted.acted, JSON.stringify({ variant: variant.variant, progress }, null, 2)).toBe(true);
        await waitForProgressChange(page, beforeKey, { timeout: 15000 }).catch(() => {});
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }

      for (const message of browserErrors) {
        if (/favicon|ResizeObserver loop|Failed to load resource/i.test(message)) continue;
        issues.push(message);
      }

      rows.push({
        game: variant.game,
        variantId: variant.variant,
        mode: "tournament",
        screen: "live tournament start/action smoke",
        actionBeforeCrash,
        status: issues.length ? "FAIL" : "PASS",
        issues,
      });
    });
  }
});
