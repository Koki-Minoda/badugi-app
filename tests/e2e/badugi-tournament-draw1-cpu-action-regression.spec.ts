import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { getProgressState, invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/badugi");
const SUMMARY_PATH = path.join(REPORT_DIR, "badugi-tournament-draw1-cpu-action-summary.json");

function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

async function openBadugiTournament(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=badugi&mgxQa=mobile`);
  await waitForE2EDriver(page);
  await invokeE2E(page, "startTournamentMTT", {
    id: "badugi-draw1-cpu-action-regression",
    name: "Badugi DRAW1 CPU Regression",
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

test("Badugi tournament CPU DRAW1 action applies through canonical snapshot path", async ({ page }) => {
  test.setTimeout(120000);
  ensureReportDir();
  await openBadugiTournament(page);

  const fixture = await invokeE2E(page, "setupBadugiTournamentCpuDrawFixtureForTest");
  expect(fixture?.variantId).toBe("badugi");
  expect(fixture?.phase).toBe("DRAW");
  expect(fixture?.turn ?? fixture?.nextTurn).toBe(2);

  const debugBefore = await invokeE2E(page, "getControllerDebug");
  const snapshot = await invokeE2E(page, "forceControllerAction", 2, {
    type: "draw",
    discardIndexes: [0, 1, 2],
  });
  const failure = await invokeE2E(page, "getLastControllerActionFailure");
  await page.waitForTimeout(500);
  const progress = await getProgressState(page);

  const summary = {
    generatedAt: new Date().toISOString(),
    appUrl: APP_URL,
    fixture,
    debugBefore,
    snapshot,
    failure,
    progress: {
      handId: progress?.handId ?? null,
      phase: progress?.phase ?? null,
      actor: progress?.actor ?? null,
      drawRoundIndex: progress?.drawRoundIndex ?? null,
      isTerminal: Boolean(progress?.isTerminal),
    },
  };
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);

  expect(debugBefore?.controllerVariantRef).toBe("badugi");
  expect(debugBefore?.gameVariant ?? "badugi").not.toMatch(/D01|D02|S01|S02|DrawLowball/i);
  expect(snapshot).toBeTruthy();
  expect(snapshot?.players?.[2]?.hasDrawn).toBe(true);
  expect(snapshot?.players?.[2]?.lastDrawCount).toBe(3);
  expect(failure).toBeNull();
  expect(progress?.phase).not.toBe("DRAW");
});
