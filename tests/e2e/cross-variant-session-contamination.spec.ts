import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/cross-variant");
const TRACE_PATH = path.join(REPORT_DIR, "cross-variant-state-trace.jsonl");

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
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variantId}`);
  await waitForE2EDriver(page);
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 30000 });
}

async function startBadugiTournament(page: Page) {
  await invokeE2E(page, "startTournamentMTT", {
    id: "cross-variant-badugi-regression",
    name: "Cross Variant Regression",
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

test.describe("cross-variant session contamination", () => {
  test.beforeEach(() => {
    ensureReportDir();
    fs.writeFileSync(TRACE_PATH, "");
  });

  for (const previousVariant of ["D01", "D02", "S01"] as const) {
    test(`${previousVariant} cash -> Badugi tournament does not reuse stale controller/session state`, async ({ page }) => {
      await openCashVariant(page, previousVariant);
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
      appendTrace({ label: "after-switch", previousVariant, audit: after });

      expect(after.currentVariant).toBe("badugi");
      expect(after.nextMode).toBe("tournament-mtt");
      expect(after.controllerClass ?? "").not.toMatch(/D1|D2|S1|S2|DrawLowball/i);
      expect(after.controllerVariantRef).toBe("badugi");
      expect(after.leakAudit.status).toBe("PASS");
    });
  }

  test("Badugi tournament -> D01 cash starts with fresh draw-lowball controller", async ({ page }) => {
    await openCashVariant(page, "badugi");
    await startBadugiTournament(page);
    const before = await invokeE2E(page, "getCrossVariantStateAudit", {
      previousVariant: null,
      previousMode: null,
    });
    appendTrace({ label: "before-switch", previousVariant: "badugi", audit: before });

    await page.evaluate(() => {
      window.__BADUGI_E2E__?.forceDealNewHandNow?.();
    });
    await openCashVariant(page, "D01");
    const after = await invokeE2E(page, "getCrossVariantStateAudit", {
      previousVariant: "badugi",
      previousMode: "tournament-mtt",
      previousHandId: before?.newHandId ?? null,
    });
    appendTrace({ label: "after-switch", previousVariant: "badugi", audit: after });

    expect(after.currentVariant).toBe("deuce_to_seven_triple_draw");
    expect(after.nextMode).toBe("cash");
    expect(after.controllerVariantRef).toBe("deuce_to_seven_triple_draw");
    expect(after.leakAudit.status).toBe("PASS");
  });
});

