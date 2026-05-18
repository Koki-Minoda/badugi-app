import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { CORE5_VARIANTS } from "./helpers/core5LayoutAuditHelper";
import {
  getProgressState,
  invokeE2E,
  progressKey,
  waitForE2EDriver,
  waitForProgressChange,
} from "./helpers/gameProgressHelper.js";
import { assertBrowserGameplayInvariants } from "../../src/ui/qa/assertBrowserGameplayInvariants.js";

const REPORT_DIR = path.resolve("reports/phase-machine");
const SUMMARY_PATH = path.join(REPORT_DIR, "core5-phase-machine-regression.json");

function writeSummary(rows: unknown) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(rows, null, 2)}\n`);
}

async function openVariant(page, variantId: string) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variantId}`);
  await waitForE2EDriver(page);
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 30000 });
  await page.evaluate(() => window.__MGX_CLEAR_GAMEPLAY_TRACE__?.());
}

function chooseAction(progress: any) {
  const phase = String(progress?.phase ?? "").toUpperCase();
  const actor = progress?.actor;
  const player = typeof actor === "number" ? progress?.players?.[actor] : null;
  if (phase === "DRAW") {
    return { type: "DRAW", discardIndexes: [] };
  }
  const toCall = Math.max(0, Number(progress?.currentBet ?? 0) - (Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet) || 0));
  return toCall > 0 ? { type: "CALL", amount: toCall } : { type: "CHECK" };
}

test("Core5 settled browser states have legal phase machine transitions", async ({ page }) => {
  const rows: any[] = [];
  const violations: any[] = [];

  for (const variant of CORE5_VARIANTS) {
    await openVariant(page, variant.variant);
    const trace: any[] = [];
    for (let step = 0; step < 18; step += 1) {
      const row = await page.evaluate(
        ({ label }) => window.__MGX_GET_GAMEPLAY_SNAPSHOT__?.({ label, mode: "cash" }),
        { label: `${variant.variant}-step-${step}` },
      );
      const assertion = assertBrowserGameplayInvariants(row, trace);
      trace.push(row);
      rows.push({
        variant: variant.variant,
        step,
        phase: row?.phase,
        drawRound: row?.drawRound,
        betRound: row?.betRound,
        violations: assertion.violations,
      });
      violations.push(...assertion.violations.filter((entry) => entry.severity === "P0").map((entry) => ({ variant: variant.variant, step, ...entry })));
      const progress = await getProgressState(page);
      if (progress?.isTerminal) break;
      if (typeof progress?.actor !== "number") break;
      const before = progressKey(progress);
      await invokeE2E(page, "forceControllerAction", progress.actor, chooseAction(progress));
      await waitForProgressChange(page, before, { timeout: 10000 }).catch(() => {});
    }
  }

  writeSummary({ rows, violations, summaryPath: SUMMARY_PATH });
  expect(violations, JSON.stringify({ violations, summaryPath: SUMMARY_PATH }, null, 2)).toEqual([]);
});
