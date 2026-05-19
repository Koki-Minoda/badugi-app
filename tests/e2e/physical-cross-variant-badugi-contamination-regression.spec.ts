import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { getProgressState, invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/cross-variant");
const TRACE_PATH = path.join(REPORT_DIR, "physical-cross-variant-badugi-contamination.jsonl");

function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function appendTrace(row: unknown) {
  ensureReportDir();
  fs.appendFileSync(TRACE_PATH, `${JSON.stringify(row)}\n`);
}

async function openCashVariant(page: Page, variantId: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variantId}&mgxQa=mobile`);
  await waitForE2EDriver(page);
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 30000 });
}

async function startBadugiTournament(page: Page) {
  await invokeE2E(page, "startTournamentMTT", {
    id: "physical-cross-variant-badugi-regression",
    name: "Physical Cross Variant Regression",
    tables: 1,
    seatsPerTable: 6,
    startingStack: 5000,
    gameVariant: "badugi",
    gameRotation: ["badugi"],
    rotationPolicy: "fixed",
    levels: [{ levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 999 }],
    payouts: [{ place: 1, percent: 100 }],
  });
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 30000 });
}

function handLengths(players = []) {
  return players.map((player: any) => player?.hand?.length ?? 0).filter((count: number) => count > 0);
}

test.describe("physical cross-variant Badugi contamination regression", () => {
  test.beforeEach(() => {
    ensureReportDir();
    fs.writeFileSync(TRACE_PATH, "");
  });

  for (const previousVariant of ["D01", "D02", "S01", "S02", "badugi"] as const) {
    test(`${previousVariant} cash -> Badugi tournament has four-card Badugi state only`, async ({ page }) => {
      test.setTimeout(120000);
      await openCashVariant(page, previousVariant);
      await invokeE2E(page, "forceDealNewHandNow");
      await page.waitForTimeout(300);
      const before = await invokeE2E(page, "getCrossVariantStateAudit", {
        previousVariant: null,
        previousMode: null,
      });
      appendTrace({ label: "before-switch", previousVariant, audit: before });

      await startBadugiTournament(page);
      const after = await invokeE2E(page, "getCrossVariantStateAudit", {
        previousVariant,
        previousMode: "cash",
        previousHandId: before?.newHandId ?? null,
      });
      const progress = await getProgressState(page);
      appendTrace({ label: "after-switch", previousVariant, audit: after, progress });

      expect(after.currentVariant).toBe("badugi");
      expect(after.controllerClass ?? "").not.toMatch(/D1|D2|S1|S2|DrawLowball/i);
      expect(after.leakAudit.status).toBe("PASS");
      expect(handLengths(progress?.players ?? [])).not.toContain(5);
      expect(handLengths(progress?.players ?? []).every((count) => count === 4)).toBe(true);
    });
  }
});
