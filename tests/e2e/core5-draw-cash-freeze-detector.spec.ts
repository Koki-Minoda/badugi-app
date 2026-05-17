import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";
import {
  getProgressState,
  performSafeAction,
  progressKey,
  summarizeProgressState,
  waitForE2EDriver,
  waitForProgressChange,
} from "./helpers/gameProgressHelper.js";
import {
  createBrowserGameplayRuntimeTelemetry,
  writeBrowserGameplayRuntimeTelemetry,
} from "../../src/ui/qa/browserGameplayRuntimeTelemetry.js";

const REPORT_DIR = path.resolve("reports/browser-gameplay/runtime");
const REPORT_PATH = path.join(REPORT_DIR, "draw-cash-freeze-detector.json");
const VARIANTS = (process.env.BROWSER_FREEZE_DETECTOR_VARIANTS ?? "D01,D02")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const HANDS = Math.max(1, Number(process.env.BROWSER_GAMEPLAY_HANDS ?? 100));
const MAX_STEPS_PER_HAND = Math.max(30, Number(process.env.BROWSER_GAMEPLAY_MAX_STEPS ?? 120));
const FREEZE_MS = Math.max(5000, Number(process.env.BROWSER_FREEZE_THRESHOLD_MS ?? 45000));
const TEST_TIMEOUT_MS = Math.max(30000, Number(process.env.BROWSER_GAMEPLAY_TIMEOUT_MS ?? 2700000));

const rows: any[] = [];

function ensureDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function writeReport() {
  ensureDir();
  fs.writeFileSync(
    REPORT_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        handsTarget: HANDS,
        freezeThresholdMs: FREEZE_MS,
        status: rows.some((row) => row.status === "FAIL") ? "FAIL" : "PASS",
        rows,
      },
      null,
      2,
    )}\n`,
  );
}

async function openVariant(page: Page, variantId: string) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=${variantId}`);
  await waitForE2EDriver(page);
  await page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 30000 });
}

async function advanceTerminal(page: Page, progress: any) {
  const beforeKey = progressKey(progress);
  const nextHand = page.getByRole("button", { name: /next hand/i }).first();
  if (await nextHand.isVisible().catch(() => false)) {
    await nextHand.click({ timeout: 3000 }).catch(async () => nextHand.click({ force: true, timeout: 3000 }));
  }
  await waitForProgressChange(page, beforeKey, { timeout: 15000 }).catch(() => {});
}

async function runFreezeDetector(page: Page, variantId: string) {
  const telemetry = createBrowserGameplayRuntimeTelemetry({
    variantId,
    mode: "cash",
    viewport: "desktop",
    handsTarget: HANDS,
    traceMode: "freeze-detector",
  });
  const failure: any = null;
  let completed = 0;
  let lastKey: string | null = null;
  let lastProgressAt = Date.now();
  const samples: any[] = [];

  for (let hand = 0; hand < HANDS; hand += 1) {
    for (let step = 0; step < MAX_STEPS_PER_HAND; step += 1) {
      telemetry.recordSnapshot(1);
      const progress = await getProgressState(page);
      const key = progressKey(progress);
      const changed = key !== lastKey;
      telemetry.recordProgress(key);
      if (changed) {
        lastKey = key;
        lastProgressAt = Date.now();
      }
      samples.push({
        hand,
        step,
        changed,
        idleMs: Date.now() - lastProgressAt,
        progress: summarizeProgressState(progress),
        isTerminal: Boolean(progress?.isTerminal),
      });

      if (Date.now() - lastProgressAt >= FREEZE_MS) {
        return {
          status: "FAIL",
          classification: "REAL_FREEZE",
          completed,
          failure: {
            reason: "same hand/action/phase exceeded freeze threshold",
            freezeMs: Date.now() - lastProgressAt,
            tail: samples.slice(-12),
          },
          telemetry: telemetry.summary({ handsCompletedByDetector: completed }),
        };
      }

      if (progress?.isTerminal) {
        completed += 1;
        telemetry.completeHand(hand, progress);
        if (hand < HANDS - 1) await advanceTerminal(page, progress);
        break;
      }

      const beforeKey = key;
      const actionToken = telemetry.startAction({ handIndex: hand, step, progress, payload: { type: "safe" } });
      const actionStart = Date.now();
      const acted = await performSafeAction(page, { policy: "safe", autoCpu: false });
      telemetry.endAction(actionToken, { acted: acted.acted, clickedAction: acted.clickedAction, payload: { type: acted.clickedAction } });
      telemetry.recordWait(Date.now() - actionStart, "perform-safe-action");
      if (!acted.acted) {
        await waitForProgressChange(page, beforeKey, { timeout: 3000 }).catch(() => {});
      }
    }
  }

  return {
    status: "PASS",
    classification: "NO_REAL_FREEZE",
    completed,
    failure,
    telemetry: telemetry.summary({ handsCompletedByDetector: completed }),
  };
}

test.describe("Core5 draw cash freeze detector", () => {
  test.describe.configure({ timeout: TEST_TIMEOUT_MS });

  test.afterAll(writeReport);

  for (const variantId of VARIANTS) {
    test(`${variantId} cash desktop does not freeze`, async ({ page }) => {
      await openVariant(page, variantId);
      const result = await runFreezeDetector(page, variantId);
      const telemetryPath = path.join(REPORT_DIR, `${variantId.toLowerCase()}-cash-desktop-freeze-detector-telemetry.json`);
      writeBrowserGameplayRuntimeTelemetry(telemetryPath, result.telemetry);
      rows.push({ variantId, ...result, telemetryPath });
      expect(result.status, JSON.stringify(result, null, 2)).toBe("PASS");
    });
  }
});
