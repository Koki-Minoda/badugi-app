import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { getProgressState, invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/badugi");
const SUMMARY_PATH = path.join(REPORT_DIR, "badugi-folded-draw-freeze-summary.json");

function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

test("Badugi DRAW does not wait forever on a folded hero", async ({ page }) => {
  ensureReportDir();
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=badugi&mgxQa=mobile`);
  await waitForE2EDriver(page);

  const fixture = await invokeE2E(page, "setupBadugiFoldedDrawFreezeFixtureForTest");
  await page.waitForTimeout(300);
  const progress = await getProgressState(page);
  fs.writeFileSync(
    SUMMARY_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), fixture, progress }, null, 2)}\n`,
  );

  expect(fixture?.phase).toBe("DRAW");
  expect(fixture?.players?.[0]?.folded || fixture?.players?.[0]?.hasFolded).toBe(true);
  if (!progress?.isTerminal) {
    expect(progress?.actor).toBe(1);
    expect(progress?.players?.[progress.actor]?.folded || progress?.players?.[progress.actor]?.hasFolded).toBe(false);
  } else {
    expect(progress?.actor).toBeNull();
  }
  expect(progress?.ui?.actions ?? []).toHaveLength(0);
});
