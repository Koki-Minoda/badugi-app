import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import { invokeE2E, waitForE2EDriver } from "./helpers/gameProgressHelper.js";

const REPORT_DIR = path.resolve("reports/badugi");
const SUMMARY_PATH = path.join(REPORT_DIR, "badugi-hand-shape-contamination-summary.json");

function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

test("Badugi rejects stale five-card hand snapshots", async ({ page }) => {
  ensureReportDir();
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=badugi&mgxQa=mobile`);
  await waitForE2EDriver(page);

  const result = await invokeE2E(page, "setupBadugiHandShapeContaminationFixtureForTest");
  const audit = await invokeE2E(page, "getCrossVariantStateAudit", {
    previousVariant: "D01",
    previousMode: "cash",
  });
  fs.writeFileSync(
    SUMMARY_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), result, audit }, null, 2)}\n`,
  );

  expect(result?.shapeAudit?.status).toBe("FAIL");
  expect(result?.shapeAudit?.violations?.[0]?.type).toBe("HAND_SHAPE_MISMATCH");
  expect(result?.acceptedEngineHandLengths ?? []).not.toContain(5);
  expect(audit?.leakAudit?.status).toBe("PASS");
});
